---
title: House of spirit
date: 2025-03-22 20:55:00 +0800
category: Linux heap
tags: [pwnable, heap]
#pin: true
---


> **House of Spirit**는 힙 상의 특정 오브젝트를 악의적으로 조작하여 프로그램의 흐름을 제어하거나 원하는 코드를 실행하는 데 사용됩니다. 
이 기법은 특히 더 이상 사용되지 않는, 즉 **free된 메모리**를 재활용하는 방식에서 발생하는 취약점을 이용합니다.
> 

## 사용 조건

- House of Spirit은 1) `stack`에 가짜 청크를 쓰고 2) 해당 stack의 주소에서 `0x10`을 더한 주소로 `free()`를 호출할 수 있을 경우 구현할 수 있습니다.

### `_int_free()` **이해하기**

1. **청크 크기 확인**:
    - 먼저, 전달된 청크의 크기가 **fastbin 크기**(작은 청크, 일반적으로 16~64 bytes)에 해당하는지 확인한다.
    - fastbin에 해당하지 않는 크기의 청크는 다른 bin(Smallbin, Largebin 등)으로 관리된다.
2. **다음 청크(next chunk)의 "size" 값 검사**:
    - 현재 해제하려는 청크 바로 다음에 위치한 **다음 청크의 "size" 필드** 값을 확인한다.
    - 이 과정에서 두 가지 조건을 검사한다:
        - **조건 1**: 다음 청크의 "size" 값에서 사용된 플래그 비트(flag bits)를 제거한 결과가 `2 * SIZE_SZ`(기본 시스템에서 약 16 또는 32 bytes)보다 크거나 같아야 한다.
            - 만약 값이 작으면 비정상적인 청크로 간주된다.
        - **조건 2**: 다음 청크의 "size" 값이 힙 영역의 시스템 메모리 크기(`av->system_mem`)보다 작아야 한다.
            - 만약 크기가 `system_mem`보다 크면 비정상적인 청크로 간주된다.
3. **Arena 잠금 후 재검사**:
    - Arena(메모리 관리 구조)가 잠겨 있지 않은 경우, 위 조건 검사를 한 번 더 수행한다.
    - 이유: `av->system_mem` 값이 메모리 경쟁 상황에서 일시적으로 잘못된 값을 가질 수 있기 때문이다.
4. **비정상적인 경우 처리**:
    - 위 조건들 중 하나라도 충족되지 않으면, **"free(): invalid next size (fast)"**라는 오류 메시지를 출력하며 프로그램을 종료한다.
    - 이 메시지는 다음 청크의 "size" 값이 비정상적이라는 의미이다.
5. **정상적인 경우**:
    - 위 조건들을 모두 통과하면 해당 청크는 정상적인 상태로 간주된다.
    - 그런 다음, 해당 청크는 fastbin 리스트에 추가된다.
6. ✅**Stack 영역에 대한 검증은 없음**:
    - `_int_free()`는 전달된 포인터가 스택(stack)에 속해 있는지 확인하지 않는다.
    - 따라서 스택 주소를 잘못 전달하면 예상치 못한 동작이 발생할 수 있다.

<br>
<br>

```c
if ((unsigned long)(size) <= (unsigned long)(get_max_fast ())
 
#if TRIM_FASTBINS
      /*
    If TRIM_FASTBINS set, don't place chunks
    bordering top into fastbins
      */
      && (chunk_at_offset(p, size) != av->top)
#endif
      ) {
 
    if (__builtin_expect (chunksize_nomask (chunk_at_offset (p, size))
              <= 2 * SIZE_SZ, 0)
    || __builtin_expect (chunksize (chunk_at_offset (p, size))
                 >= av->system_mem, 0))
    {
    /* We might not have a lock at this point and concurrent modifications
       of system_mem might have let to a false positive.  Redo the test
       after getting the lock.  */
    if (have_lock
        || ({ assert (locked == 0);
          __libc_lock_lock (av->mutex);
          locked = 1;
          chunksize_nomask (chunk_at_offset (p, size)) <= 2 * SIZE_SZ
            || chunksize (chunk_at_offset (p, size)) >= av->system_mem;
          }))
      {
        errstr = "free(): invalid next size (fast)";
        goto errout;
      }
    if (! have_lock)
      {
        __libc_lock_unlock (av->mutex);
        locked = 0;
      }
    }
 
    free_perturb (chunk2mem(p), size - 2 * SIZE_SZ);
 
    set_fastchunks(av);
    unsigned int idx = fastbin_index(size);
    fb = &fastbin (av, idx);
 
    /* Atomically link P to its fastbin: P->FD = *FB; *FB = P;  */
    mchunkptr old = *fb, old2;
    unsigned int old_idx = ~0u;
```

`free()`는 스택에 대한 검사가 없다 →

스택에 청크 구조를 만들고 속일 수 있다. →

`fastbin`에 스택 영역이 들어간다 →

`malloc()` →

‘원하는 스택 영역’을 할당할 수 있다.

## 예시

![](https://velog.velcdn.com/images/backhoe/post/9dbc36f2-c4dd-4ae7-95d6-29850aae9e6f/image.png)


- House of Spirit은 stack에 가짜 청크를 쓰고 해당 stack의 주소에서 0x10을 더한 주소로 free()를 호출할 수 있을 경우 구현할 수 있습니다.
    - Stack에 Fastbin에 해당하는 Fake chunk를 작성한 후 메모리 할당을 malloc()에 요청 합니다
    
    
> free() 전에 malloc()을 하는 이유:
초기화되지 않은 힙 영역은 힙 관리자가 정확히 추적하지 못할 수 있기 때문에, `malloc()`으로 힙 메모리를 먼저 할당하여 **관리 가능한 상태**로 만들기 위함이다.
    

    
- 그리고 Fake chunk의 주소에 0x10를 더한 주소로 free()를 호출하면, 해당 chunk의 포인터가 Fastbin[]에 저장됩니다.
- 해당 chunk의 크기로 malloc()을 호출하면, Fastbin[]에 저장된 Fake chunk의 포인터를 반환합니다.
    - 즉, 해당 포인터는 Stack영역의 메모리 입니다.
- 예를 들어 다음과 같이 Fake chunk의 "size"의 값이 0x80이고 다음 chunk의 "size"값이 0x1000인 Fake chunk를 Stack에 작성합니다.
    - 크기가 0x3e8(1000)인 메모리 할당을 malloc()에 요청합니다.
    - Fake chunk의 포인터(0x7fffffffe3d0)의 해제를 free()에 요청합니다.
    - 크기가 0x70인 메모리의 할당을 위해 malloc()을 호출합니다.
    - 할당자는 fastbinsY[6]에 저장된 포인터를 재 할당됩니다.
    - 반환된 메모리는 Stack영역입니다.
<br>
<br>

---
https://github.com/shellphish/how2heap/blob/master/glibc_2.35/house_of_spirit.c

https://www.lazenca.net/pages/viewpage.action?pageId=1148022
<br>
<br>

---
우분투 16.04 기준으로 공부 및 작성했습니다.