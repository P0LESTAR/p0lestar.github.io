---
title: Fastbin duplicate
date: 2025-03-21 20:55:00 +0800
category: Linux heap
tags: [pwnable, heap]
#pin: true
---


## **Fastbin duplicate**

- "Fastbin duplicate"는 fastbin에 배치된 리스트를 악용한 공격입니다.
    - 애플리케이션이 fastbin에 포함되는 메모리들을 중복으로 해제를 요청할 경우 할당자는 해당 chunk들을 list에 중복으로 배치합니다.
    - 중복으로 등록된 chunk와 동일한 크기의 메모리 할당을 여러번 요청하면, 할당자는 해당 chunk의 포인터를 중복으로 리턴합니다.
    - ~~이러한 악용은 fastbin에서만 가능합니다.~~  (tcache가 생기고 tcache_dup 기법도 생겨났다)
- 예를 들어 malloc()에 크기가 112byte인 메모리의 할당을 3번 요청합니다.
    - 애플리케이션이 첫번째 메모리의 포인터를 인수로 free()를 호출하면 할당자는 해당 chunk를 fastbin[6]에 배치합니다.
    - 그리고 애플리케이션이 두번째 메모리를 해제를 요청하면 할당자는 fastbin[6]에 배치된 chunk의 fd에 해당 chunk를 배치합니다.
    - 이미 해제된 첫번째 메모리를 다시 해제를 요청하면 해당 chunk가 fastbin[6]의 list 마지막에 배치됩니다.
    - 즉, Fastbin[6]의 list는 "첫번째 메모리(0x602000) --> 두번째 메모리(0x602080) --> 첫번째 메모리(0x602000) --> ..." 와 같은 형태가 됩니다.
- 애플리케이션이 malloc()에 해제된 메모리와 같은 크기의 메모리의 할당을 요청합니다.
    - 첫번째 요청에서는 Fastbin에 마지막에 배치된 메모리가 재할당합니다.
    - 두번째 요청에서는 그 다음 메모리가 재할당됩니다.
    - 세번째 요청에서 첫번째 요청에서 할당받은 메모리와 동일한 메모리가 할당됩니다.
- 즉 애플리케이션은 첫번째 메모리와 세번째 메모리의 포인터는 서로 같은 포인터입니다.


![](https://velog.velcdn.com/images/backhoe/post/38611c79-5be2-4bd4-9265-f5162507854d/image.png)


<br>
<br>
<br>

---
## fastbin_dup_into_stack

- "Fastbin dup into stack"은 "Fastbin dup"을 활용하여 malloc()으로 부터 Stack 메모리를 반환 받을수 있습니다.
- 기본적인 원리는 "Fastbin dup"와 같습니다.
    - 첫번째 메모리를 해제되고, 두번째 메모리를 해제한 후 첫번째 메모리를 다시 해제합니다.
    - fastbin에 이미 등록된 메모리와 동일한 메모리가 배치되었습니다.
    - fastbin의 상단에 배치된 chunk는 두번째 chunk를 가리키고 두번째 chunk는 상단에 배치된 chunk를 가리키게됩니다.
    - 즉 fastbin의 list는 loop가 됩니다.(Fastbin[6]의 list는 "0x602000 <--> 0x602080)
- 이러한 list를 활용하여 malloc()으로 부터 Stack의 pointer를 반환받을 수 있도록 악용합니다.
    - 우선 공격자는 list에 배치된 chunk를 재할당 받기위해 메모리 할당을 요청합니다.
    - 그리고 공격자는 stack 주소를 할당받은 메모리의 fd에 저장합니다.
        - 이로 인해 list는 "0x602000 --> Stack"이 됩니다.
- 해당 Stack에 가짜 chunk 정보를 입력합니다.
    - 재할당 받은 chunk의 크기를 가짜 chunk의 "size"에 입력합니다.
    - 할당자는 stack에 생성한 가짜 chunk를 정상적인 chunk로 인식합니다.
    - fake chunk의 크기를 인수로 malloc()를 호출하면, 할당자는 fastbin에 등록된 fake chunk를 반환합니다.
- 할당자는 fastbin에 배치된 메모리를 재할당 할때 해당 chunk의 size를 확인하고, fd를 확인해서 list를 갱신합니다.
    - 해당 주소가 힙인지 스택인지는 확인하지 않습니다.
    
![](https://velog.velcdn.com/images/backhoe/post/8dea3b96-fdc5-4bb7-b1df-7676528a5682/image.png)

<br>
<br>

워게임을 푸는게 이해에 도움이 됐습니다.

---
https://github.com/shellphish/how2heap/blob/master/glibc_2.35/fastbin_dup.c

https://www.lazenca.net/pages/viewpage.action?pageId=1148141

https://github.com/shellphish/how2heap/blob/master/glibc_2.35/fastbin_dup_into_stack.c

https://www.lazenca.net/pages/viewpage.action?pageId=1148143

---

우분투 16.04 기준으로 공부 및 작성했습니다.