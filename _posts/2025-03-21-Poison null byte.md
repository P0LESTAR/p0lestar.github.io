---
title: Posion Null Byte
date: 2025-03-21 20:57:00 +0800
category: Linux heap
tags: [pwnable, heap]
#pin: true
---

> Poison Null Byte는 리눅스 힙 메모리에서 **null byte (\x00)**를 활용하여 glibc의 malloc과 free의 동작을 조작하는 힙 익스플로잇 기법 중 하나다. 이는 unlink()를 이용한 classic heap overflow 공격이 패치된 후에도 사용할 수 있었던 기법이며, glibc 2.27 이후에는 더 이상 사용되지 않는다.
- heap 버전 Off-By-One
{: .prompt-info }

### 사용 조건
1. 빈 청크의 "size"에 **null byte**를 저장할 수 있으며 
2. 변경된 크기가 유효한 크기가 되면 사용할 수 있다.
  3.  공격자에 의해 다음과 같은 Heap 영역을 할당, 해제 할 수 있어야 합니다.
- 0x200 이상의 heap 영역 : 공격 대상 heap영역
- Fast bin 이상의 Heap 영역(Heap size : 0x80이상) : 공격 대상 영역에 할당 Heap 영역 
- 공격자에 의해 Free chunk의 size영역에 1byte를 NULL로 변경 할 수 있어야 합니다. 
- 공격자에 의해 Free chunk의 size보다 작은 heap영역을 2개 할당 할 수 있어야합니다.
- Fast chunk는 사용할 수 없습니다.




## 예시

![](https://velog.velcdn.com/images/backhoe/post/d272fa35-8cc0-46b7-aa8a-fbbc40362825/image.png)

- 예를 들어 다음과 같이 크기가 0x80, 0x200, 0x80인 메모리를 할당 받습니다.(청크A,B,C)
  - 0x200을 0x602290에 저장한 후 2번째 메모리를 해제합니다.

> glibc에서 chunksize(P)와 prev_size(next_chunk(P))가 같은지 검사한다.
- 아래에서 청크의 “size”를 0x200으로 조작할것이기 때문에 prev_size(next_chunk(P))에 해당하는 주소에 0x200을 저장해두는 것이다.
{: .prompt-tip }

  - null byte를 이 chunk의 "size"에 덮어씁니다.
    그러면 해당 chunk의 크기는 0x200이 됩니다.	

![](https://velog.velcdn.com/images/backhoe/post/5464d17d-90ce-43e9-bf58-0f7663870574/image.png)


- 4번째, 5번째(크기가 0x80) 메모리 할당을 malloc()에 요청합니다. (청크B1,B2)
  - 할당자는 free chunk를 크기를 확인하고, 해당 chunk의 크기가 요청되어 메모리를 할당하기에 적당한 크기인지 확인합니다.
  - 해당 chunk의 "size"에 저장된 값이 0x200이기 때문에 요청된 메모리를 할당하기에 충분한 크기입니다.
  - malloc은 해당 chunk의 공간을 분할하여 메모리를 할당합니다.
- 청크B1이 해제되고 청크C를 해제된다면 할당자는 청크C의 다음 chunk를 top chunk로 설정합니다.
  - 그리고 prev_size의 값이 0x210이기 때문에 Top chunk의 주소가 0x602090이 됩니다.
  - 이로써 Top chunk는 청크B2 앞에 배치됩니다.

> B1, C를 차례로 free를 하면 B2의 존재는 무시하고 병합이 이루어진다.
- 그 이유는 C가 free될 당시 C의 prev_size는 0x210이니, 이전의 메모리가 사용되고 있지 않은 중으로 OS가 판단하기 때문이다.  
(INUSE flag ==0)
{: .prompt-tip }

- 그리고 크기가 0x280인 메모리 할당을 요청해서 반환받은 메모리는 청크B2와 영역이 겹치게 됩니다.

<br>

---
https://www.lazenca.net/pages/viewpage.action?pageId=1148145

https://github.com/shellphish/how2heap/blob/master/glibc_2.35/poison_null_byte.c

https://bachs.tistory.com/entry/how2heap-Poison-NULL-Byte

---
우분투 16.04 glibc 2.23 버전으로 공부 및 작성했습니다.