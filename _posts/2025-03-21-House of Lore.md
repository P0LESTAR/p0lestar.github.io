---
title: House of Lore
date: 2025-03-21 20:56:00 +0800
category: Linux heap
tags: [pwnable, heap]
#pin: true
---

> 'House of Lore'는 smallbin 크기의 청크가 존재할때 bk를 조작하여 **fake chunk**를 smallbin에 넣고 할당 요청 시 이를 가로채는 힙 익스플로잇 기법이다
{: .prompt-info }

## 사용 조건

- Stack에 `Fake chunk` 작성 가능해야한다.
- Free chunk의 `bk` 값을 덮어쓸 수 있어야 한다.



### malloc.c
기법을 공부하기 위해, 먼저 malloc이 small bin에서 청크를 가져오는 과정(재할당)을 살펴보자.
```c

  if (in_smallbin_range (nb))
    {
      idx = smallbin_index (nb);
      bin = bin_at (av, idx);
 
      if ((victim = last (bin)) != bin) 
      //여기서 victim에 저장하는 last(bin)은 bin의 bk를 반환한다.
        {
          if (victim == 0) /* initialization check */
            malloc_consolidate (av);
          else
            {
              bck = victim->bk;
    if (__glibc_unlikely (bck->fd != victim))
                {
                  errstr = "malloc(): smallbin double linked list corrupted";
                  goto errout;
                }
              set_inuse_bit_at_offset (victim, nb);
              bin->bk = bck;
              bck->fd = bin;
 
              if (av != &main_arena)
        set_non_main_arena (victim);
              check_malloced_chunk (av, victim, nb);
```
### **`malloc()`이 small bin에서 청크를 가져오는 과정**

1. **요청된 크기가 small bin 범위에 포함되는지 확인**
    - `malloc()`이 요청한 크기가 small bin에 속하는지 체크한다.
2. **해당 크기에 맞는 small bin index 찾기**
    - 요청된 크기에 맞는 **bin[index]**를 찾는다.
3. **bin[index]에서 victim 선택**
    - `bin[index]`의 **`bk` 포인터**를 따라가서 **victim**(재사용할 청크)을 선택한다.
4. **victim이 존재하는지 확인**
    - `victim`이 `NULL(0)`이면 할당할 청크가 없으므로 다른 할당 방식으로 넘어간다.
    - `victim`이 존재하면 다음 단계를 진행한다.
5. **victim의 `bk` 값을 저장**
    - `victim->bk` 값을 `bck`에 저장한다.
6. **victim이 bin의 연결 리스트 무결성을 유지하는지 확인**
    - `bck->fd` 값이 `victim`과 같은지 비교한다.
    - 다르면 "malloc(): smallbin double linked list corrupted" 에러를 발생시키고 프로세스를 종료한다.
    - 같으면 다음 단계 진행.
7. **victim의 size 업데이트**
    - `victim->size`에 `PREV_INUSE` 플래그를 설정한다.
8. **bin과 bck 간 연결 리스트 업데이트**
    - `bck->fd`를 `bin`으로 변경
    - `bin->bk`를 `bck`로 변경
9. **현재 arena가 main arena인지 확인**
    - main arena가 아닐 경우 `victim->size`에 `NON_MAIN_ARENA(0x4)` 플래그를 추가.
10. **할당할 주소 반환**
    - `chunk2mem()`을 호출하여 **할당할 메모리 주소를 반환**한다.
    - `victim + 2 * SIZE_SZ`를 `p`에 저장한 후 반환.

이 과정에서 `smallbin`의 **무결성**을 유지하고, `malloc` 요청에 대한 할당을 수행한다.
<br>
<br>

---


## 👊공격 흐름
1. **Stack에 Fake chunk 생성**
    - 공격자는 **Fake free chunk**를 Stack에 작성함.

> **필요한 Fake chunk 구조**
   - **첫 번째 Fake chunk** → Free chunk의 `bk`에 저장
   - **두 번째 Fake chunk** → 첫 번째 Fake chunk의 `bk`에 저장
   - victim 포인터는 첫 번째 Fake chunk의 `fd`에 저장됨.
   <br>
   - 위에서 본 malloc.c의 **double-linked list 무결성 검증("bck->fd != victim")을 우회**하는 역할을 하기 위한 구조다
   ![](https://velog.velcdn.com/images/backhoe/post/2796af8b-35ce-41ed-8772-e87f0e4b7bd1/image.png)
{: .prompt-tip }

    
2. **Small bin 메모리 할당**
    - `malloc()`을 사용하여 Small bin에 해당하는 메모리를 할당.
3. **해당 메모리 해제 (free)**
    - victim chunk를 할당 해제
4. **large bin에 해당하는 청크를 할당한다.**
    - Unsorted bin에 있는 victim chunk를 Small bin으로 옮기기 위해
5. **Fake chunk 포인터를 victim chunk의 `bk`에 덮어씀**
    - 4,5번 순서는 상관없다 (아마)
6. **Fake chunk가 `bins[]`에 배치됨**
    - 다시 같은 크기의 메모리를 할당하면, Fake chunk가 Small bin의 일부가 됨.
    - victim → bk가 Fake chunk이고 small bin은 이중연결 리스트이기 때문에
7. **Stack 메모리 반환**
    - 공격자가 `malloc()`을 다시 호출하면, **Fake chunk의 주소**를 반환.
    - 이 포인터는 **Stack 영역**을 가리키므로 **Stack을 조작 가능**.

![](https://velog.velcdn.com/images/backhoe/post/b6a06ffd-2257-4db9-8ddc-9d05dbc083e2/image.png)


---

`glibc 2.26` 이상부터는 tcache가 생겼기 때문에, smallbin을 할당하는 루틴 중에 smallbin에 위치한 free’d chunk들을 같은 size의 tcache_entry로 이동시키는 루틴이 생겼다.

while 반복문을 돌면서, tcache entry가 모두 채워지거나, smallbin에 아무런 free’d chunk가 없을 때까지 tcache_put 함수를 실행하려고 한다. 따라서, glibc 2.23 때와 같이, fake_chunk와 bypass_chunk 딱 2개만 만들면, tcache로 옮기는 과정에서 segmentation fault가 반드시 발생하게 된다.

- **tcache->counts[tc_idx] < mp_.tcache_count**

이를 우회하기 위해서는 tcache를 모두 채울 만큼 충분한 개수(7개)의 fake_chunk를 만들면 된다.

전자를 만족시켰다면(tcache entry가 모두 채워짐), 공격자는 가장 나중에 tcache에 배치됐으면서, 임의의 주소에 위치한 청크인 fake_chunk를 재할당할 수 있게 된다.

---
참고

https://www.lazenca.net/pages/viewpage.action?pageId=1148020

https://j4guar.tistory.com/58

https://brwook.github.io/posts/house-of-lore/

https://ssongkit.tistory.com/434

https://code1018.tistory.com/222

---

우분투 16.04를 기준으로 공부했습니다.