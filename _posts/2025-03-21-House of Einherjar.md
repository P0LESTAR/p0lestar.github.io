---
title: House of Einherjar
date: 2025-03-21 20:58:00 +0800
category: Linux heap
tags: [pwnable, heap]
#pin: true
---

> House of einherjar는 **`_int_free()`가 chunk를 top chunk에 등록하는 과정을 악용하는 기법**입니다.
{: .prompt-info }


### _int_free() 동작 과정

- _int_free()은 전달받은 포인터가 fastbin에 포함되는 chunk인지 확인합니다.
    - 그리고 해당 chunk가 fastbin이 아닌 경우 해당 chunk가 mmap()으로 얻은 chunk인지 확인합니다.
    - 그리고 해당 chunk가 mmap()으로 얻은 청크가 아닌 경우 Arena가 잠겨있는지 확인합니다.
        - Arena가 잠겨있지 않다면 잠금을 설정합니다.
    - _int_free()는 전달 받은 포인터와 arena의 top이 가지고 있는 값이 같은지 확인합니다.
    - 그런 다음 다음 청크가 경기장의 경계를 벗어 났는지 여부와 다음 chunk가 실제로 사용되지 않는지 확인합니다.
    - 그리고 chunk의 크기가 최소한의 크기보다 작은지, 그리고 Arena의 system_mem의 값보다 큰지 확인합니다.

> 
- fastbin X? → mmap() X? → Arena 잠금 X? → arena의 top보다 작은가? → system_mem보다 큰가?
- 5가지 검사를 통해 chunk의 크기가 정상인지 확인한다
{: .prompt-tip }

- _int_free()는 해당 chunk의 size에 PREV_INUSE flag가 설정되어 있는지 확인합니다.
    - 해당 flag의 bit가 `0`이라면, 해당 chunk의 size와 prev_size를 더한 값을 size변수에 저장합니다.
    - 그리고 chunk_at_offset()를 호출해서 **해당 chunk의 포인터에서 prev_size를 뺀 포인터**를 반환하며, 해당 포인터는 `변수 p`에 저장됩니다.
        - 그리고 unlink()를 호출해서 해당 chunk를 빈 목록에서 제거합니다.
        ![](https://velog.velcdn.com/images/backhoe/post/c28aa1ef-1c88-404a-b4e1-5e5744e2b252/image.png)
- 그리고 **_int_free()는 다음 chunk가 top chunk인지 확인**합니다.
    - 만약 다음 chunk가 top chunk일 경우 다음 chunk의 크기를 size 변수에 더합니다.
    - 해당 변수가 가지고 있는 값에 PREV_INUSE flag를 설정합니다.
    - 그리고 변수 size와 변수 p를 set_head()에 전달하여 chunk의 헤더를 설정합니다.
    - 그리고 **Arena의 top에 변수 p를 저장합니다.**
    ![](https://velog.velcdn.com/images/backhoe/post/96124ebc-6764-449e-8cc4-68e3699f040f/image.png)


---
## 사용 조건

- **메모리에 fake chunk를 작성할 수 있을 때**
- **In-use chunk의 헤더를 변경할 수 있을 때**

### **1. Fake chunk를 Stack에 생성**

- 공격자는 특정 주소(Stack)에 **fake chunk 구조를 만듭니다**.
- Fake chunk는 다음과 같은 필드를 포함해야 합니다.
    - `prev_size = (마지막으로 할당된 chunk의 크기)`
    - `size = (마지막으로 할당된 chunk의 주소 - fake chunk의 주소)`
    - `fd`와 `bk` 필드에 fake chunk의 주소를 넣습니다. (아마 unlink() 우회)

### **2. 마지막 할당된 chunk의 헤더 조작**

- `prev_size` 필드를 조작해서, <span style="color:red">**fake chunk가 바로 앞에 있는 것처럼 보이도록 만듭니다**.</span>
- `size`에서 `PREV_INUSE` 비트를 제거하여 **이전 청크(free chunk)가 있다고 속입니다**.

### **3. 마지막 할당된 chunk를 `free()`**

- `free()`는 해당 청크의 **이전 청크가 free 상태인지 확인**합니다.
- **`PREV_INUSE` 플래그가 제거되었으므로, 이전 청크(free 상태라고 속인 fake chunk)와 병합이 발생합니다.**
- 병합 결과:
    - **fake chunk + 마지막 할당된 chunk가 하나의 큰 청크로 합쳐집니다**.

### **4. 병합된 청크가 힙의 끝에 위치하면, 새로운 Top chunk가 됨**

- `free()`는 병합된 청크가 **힙의 끝(Top chunk)인지 확인합니다**.
- fake chunk가 포함된 이 병합된 청크가 **힙의 마지막 주소로 인식되도록 조작했으므로**,
    - **이 병합된 청크가 새로운 Top chunk가 됩니다.**

![](https://velog.velcdn.com/images/backhoe/post/1e2b1c1b-fba9-4896-9795-7b5d7a34f7c2/image.png)
- 예를 들어 다음과 같이 크기가 0x70, 0xf0인 메모리를 할당받고, Fake chunk를 stack에 작성합니다.
    - 공격자는 0x100을 fake chunk의 prev_size에 저장하고, 해제할 chunk의 주소(0x602080)에서 fake chunk의 주소(0x7fffffffe430)를 뺀 값을 "size"에 저장합니다.
    - 공격자는 해제할 chunk의 size가 가지고 있는 값에서 PREV_INUSE flag를 제거하고, fake chunk의 size가 가지고 있는 값을 prev_size에 저장합니다.
    - 그리고 해당 chunk를 해제하면 fake chunk는 Top chunk가 됩니다.
    - 그리고 메모리 할당을 요청하면 fake chunk의 영역을 할당 받습니다.


---

### ** 최종 결과**

✅ 공격자는 **Fake chunk를 Top chunk로 변조하는 데 성공합니다**.

✅ 이후 `malloc()` 요청이 들어오면, **fake chunk의 영역을 할당받게 됩니다**.

✅ 이를 통해 원하는 **임의의 주소**를 할당받을 수 있습니다.

---

### ** 정리**

✔️ **fake chunk를 바로 앞에 있는 free chunk로 속이고, `free()` 시 병합이 발생하도록 조작합니다**.

✔️ **병합된 청크가 힙의 마지막 부분이 되도록 유도하여 Top chunk로 설정됩니다**.

✔️ **이후 malloc() 요청 시 공격자가 원하는 주소를 할당받을 수 있습니다.**

---

참고

https://www.lazenca.net/pages/viewpage.action?pageId=1148149

https://github.com/shellphish/how2heap/blob/master/glibc_2.35/house_of_einherjar.c

https://j4guar.tistory.com/59

---
우분투 16.04 glibc 2.23 기준으로 공부 및 작성했습니다.