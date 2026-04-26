---
title: React2Shell 분석 (1/3)
date: 2025-12-20 00:01:01 +0800
category: CVE
tags: [CVE, CVE-2025-55182, react2shell, 1-day분석]
#pin: true
---

## 개요
2025년 12월에 발견된 `RSC`(React Server Components)의 `React2Shell` 취약점`CVE-2025-55182`은 `Flight 프로토콜` 페이로드를 서버 측에서 역직렬화 시 안전하지 않은 검증으로 인해 발생하는 RCE 취약점입니다.

즉, 클라이언트에서 서버로 보낸 Flight 프로토콜 페이로드에 대한 검증이 완전하지 않아 발생한 문제입니다.

이 공격에 대한 핵심 취약점을 크게 세 가지로 구분할 수 있으며, 전체 공격은 세 취약점의 연계로 완성됩니다.

먼저 리액트 관련 사전지식을 정리하겠습니다.
<br>

---

## 사전 지식 React

### 1. React Server Component (RSC)

- 서버에서만 실행되는 컴포넌트입니다
- 일반 컴포넌트(Client Component)는 브라우저에서 JavaScript를 다운로드해서 실행합니다
- Server Component는 서버에서 실행되고 HTML만 브라우저로 전송합니다
- 결과: 브라우저가 다운로드할 JavaScript 양 감소 → 성능 향상

<br>

### 2. Flight Protocol

- React Server Component가 서버와 클라이언트 간에 데이터를 주고받기 위해 사용하는 통신 규약입니다

#### 역할

- 서버에서 렌더링된 컴포넌트 트리를 특수한 형식으로 직렬화(serialize)합니다
- 클라이언트로 스트리밍 방식으로 전송합니다
- 클라이언트가 받아서 다시 React 컴포넌트로 복원(deserialize)합니다
- 반대 방향도 똑같이 이뤄집니다

#### 일반 JSON과의 차이
JSON의 한계:

- 함수 직렬화 불가
- React 엘리먼트 직렬화 불가
- Promise 직렬화 불가

Flight Protocol:

- React 컴포넌트 전송 가능
- Promise 전송 가능
- 일부 함수 참조 전송 가능
- 스트리밍 지원 (데이터가 준비되는 대로 순차 전송)

#### 왜 필요한가?
서버에서 `<div>안녕</div>` 같은 JSX를 렌더링하면

이건 HTML 문자열이 아니라 React 엘리먼트 객체기 때문에 네트워크로 보내려면 특별한 변환이 필요합니다.

<br>

### 3. Promise

- 비동기 작업의 결과를 나타내는 JavaScript 내장된 객체입니다
- `new Promise()`, `fetch(`) 같은 함수와 `async`등 `비동기 작업`은 거의 다 Promise입니다
- 네트워크 요청, 파일 읽기 같은 작업은 시간이 걸리기 때문에, 그동안 프로그램이 멈춰있으면 안 되니까 "나중에 알려줄게"라고 **약속(Promise)**하는 것입니다.

#### 문제 상황
```javascript
// 서버에서 데이터 가져오기 - 시간이 걸림
const data = fetch('/api/user') // 즉시 완료 안됨
console.log(data.name) // 에러! 아직 데이터 안왔는데 쓰려고 함
```


```javascript
fetch('/api/user')
  .then(response => response.json())  // 성공하면
  .then(data => console.log(data.name))
  .catch(error => console.log(error))  // 실패하면
```
더 간단하게 (async/await)
```javascript
async function getUser() { //async function 자체도 Promise 반환
  const response = await fetch('/api/user')  // 기다림
  const data = await response.json()
  console.log(data.name)  // 이제 안전
}
```



#### Promise 구조

`.then()`은

- Promise 객체가 가진 메서드 (기능)입니다
- Promise를 다루는 도구입니다

- 구조 설명

```javascript
// 1. Promise 객체 생성
const myPromise = new Promise((resolve, reject) => {
  // 비동기 작업
  setTimeout(() => {
    resolve("성공!")  // 또는 reject("실패!")
  }, 1000)
})

// 2. Promise 객체의 메서드들
myPromise
  .then(결과 => console.log(결과))    // 성공 처리
  .catch(에러 => console.log(에러))   // 실패 처리
  .finally(() => console.log("끝"))  // 무조건 실행


// 3. fetch 예시
const promise = fetch('/api/user')  // Promise 객체가 반환됨
promise.then(...)  // 그 객체의 .then 메서드 사용
```

<br>

### 4. Flight Protocol 특수 기호

- Flight Protocol이 데이터를 직렬화할 때 사용하는 **특수 기호들**입니다

- 서버에서 클라이언트로 데이터 보낼 때, 각 타입을 구분하기 위해 `$` + 문자로 표시합니다

#### 주요 기호들

| 기호 | 타입 | 예시 | 설명 |
|-----|------|------|------|
| `$$` | Escaped $ | `"$$hello"` → `"$hello"` | 일반 문자열 (이스케이프) |
| `$@` | Promise/Chunk | `"$@0"` | 0번 청크 참조 (Promise) |
| `$F` | Server Reference | `"$F0"` | 서버 함수 참조 |
| `$T` | Temporary Ref | `"$T"` | 임시 참조 |
| `$K` | FormData | `"$K0"` | FormData |
| `$B` | Blob | `"$B0"` | Blob |
| `$N` | NaN | `"$N"` | NaN 값 |

#### 예시

##### `$@` - Promise/Chunk
```
서버: fetch('/api/user') (Promise)
전송: "$@0" (0번 청크 참조)
의미: "0번 위치에 Promise 결과가 올 거야"
```

##### `$F` - Server Function
```
서버: async function deleteUser() {...}
전송: "$F0"
클라이언트에서 이 함수 호출하면 서버에 요청 보냅니다
```

##### `$$` - 일반 문자열
```
문제: "$hello"를 보내면 특수 기호로 오해합니다
해결: "$$hello" → "$hello"로 변환 (이스케이프)합니다
```

취약점은 다음 글에..

<br>

## 참고

<https://velog.io/@xxziiko/RSC>

<https://mycodings.fly.dev/blog/2025-01-20-rsc-tutorial-1-react-server-components-explained/>

<https://www.enki.co.kr/media-center/blog/complete-analysis-of-the-react2shell-cve-2025-55182-vulnerability>

<https://asec.ahnlab.com/ko/91660/>

