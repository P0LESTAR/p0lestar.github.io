---
title: House of force
date: 2025-03-20 20:55:00 +0800
category: Linux heap
tags: [pwnable, heap]
#pin: true
---

## House of Force 사용 조건

- Top 청크의 `size` 부분을 수정할 수 있어야한다.
- 원하는 사이즈를 `malloc()`을 통해 할당 받을 수 있어야 한다.

### **`malloc()`의 동작**

- `malloc()`은 메모리 할당 요청 시, 힙 영역의 **Top 청크**에서 요청된 크기만큼 메모리를 분리한다.
- Top 청크는 현재 힙의 끝을 나타내며, 할당이 이루어질 때마다 크기가 줄어든다.
- 할당 요청은 항상 Top 청크의 시작 주소를 기준으로 이루어진다.

## 순서

1. 메모리 할당을 malloc에 요청하면 해당 메모리를 반환한다.
2. 메모리 할당을 `malloc()`에 요청한 후 Top청크의 값을 `0xffffffffffffffff`으로 덮어쓴다.
3. 원하는 메모리 영역을 할당 받기 위해 다음과 같이 계산된 malloc()함수의 인자값으로 전달한다
    - "할당 받기를 원하는 메모리의 주소"
    - "Chunk header size(16 or 8)" 
    - Top chunk address 
    - "Chunk header size(16 or 8)” (헤더 사이즈 한번 빼는지 두번 빼는지 확인 필요, 정렬에 따라 다른듯)
        
4. 메모리 할당 요청 후에 할당 받고 싶은 메모리의 주소가 Top청크에 저장된다.

> 
Top 청크가 `0x804b1b8`에서 시작하고, 네가 `malloc(0x100)`을 요청하면:        
- `malloc()`은 Top 청크의 시작 주소(`0x804b1b8`)에서 0x100만큼 할당한 후,
- 새로운 Top 청크 시작 주소는 `0x804b1b8 + 0x100 + 8 (헤더 크기)`로 변경돼.
- 우리가 원하는 건 **Top 청크를 조작해서** `malloc()`이 **원하는 메모리 주소**를 할당하도록 만드는 거야.

## 예시

- 다음과 같이 1개의 메모리를 할당받고 Top Chunk의 size값을 `0xffffffffffffffff`으로 덮어쓴다.
- `0x601010`를 할당받기 위해 malloc()에 크기가 `0xffffffffffffeee0`인 메모리 할당을 요청한다.
    - 0x601010 - 0x10 - 0x602110 - 0x10 = 0xffffffffffffeee0
- 메모리를 할당한 후에 0x601000이 `main_arena`→`top`에 저장된다.
- 메모리 할당을 malloc()에 요청하면 0x601010을 반환한다.


![](https://velog.velcdn.com/images/backhoe/post/31a03e4a-fdd0-4c5e-b1cb-a86a5c654d3a/image.png)

---

> 이 공격 기법은 최신 glibc 버전에서는 방어 기법(예: `tcache`, `malloc check`, `ASLR`)에 의해 상당히 어렵게 되었습니다. 하지만 구 버전 또는 방어가 적절히 적용되지 않은 시스템에서 여전히 유효할 수 있습니다.
> 

https://github.com/shellphish/how2heap/blob/master/glibc_2.27/house_of_force.c

https://www.lazenca.net/display/TEC/The+House+of+Force

https://jeongzero.oopy.io/d43ee8e3-dd10-4b74-9094-a1de2b9e317f


---


Ubuntu 16.04, glibc 2.23 기준으로 공부 및 작성했습니다.