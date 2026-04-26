---
title: "[XSS Agent 개발 #1] AI한테 ctf 풀려봤습니다"
date: 2025-11-16 00:01:01 +0800
category: AI
tags: [AI, Langchain, XSS]
#pin: true
published: false
---

## 1. 프로젝트 동기
최근 HackerOne에서 만든 Xbow 에이전트를 봤습니다.
<https://xbow.com/blog/top-1-how-xbow-did-it>

멀티에이전트 아키텍쳐로 만든 이 에이전트가 좋은 성적을 거둔 모습을 보고 저도 에이전트를 하나 만들어보고 싶었습니다.

그런데 Xbow의 벤치마크 결과를 보면:
  - XSS 문제 성공률: 약 50%
  - 다른 취약점 유형 대비 낮은 성공률

그래서 저는 도전적으로:<br>
  XSS 문제에 특화된 에이전트를 개발해서, Xbow보다 높은 성공률을 달성하는 걸 목표로 이 프로젝트를 시작합니다.



## 2. 기술 스택
2.1 **LangChain** - 에이전트 프레임워크

  - ReAct 패턴 구현이 간단
  - Tool 정의만 하면 자동으로 에이전트가 선택/실행
  - 에이전트 상태 관리와 메모리 지원

  2.2 **LLM** - Gemini 2.5 Flash

  - Xbow의 블로그에 따르면 같은 조건에서도, LLM의 성능에 따라 에이전트의 성공률이 크게 바뀝니다.
  - 개발 과정에서는 Gemini 2.5 Flash의 무료 API를 활용합니다.
  - 벤치마크를 측정할 때는 Xbow와 같은 GPT-5 모델을 사용할 예정입니다.

  2.3 **Playwright** - 실제 브라우저 검증

  - 이 프로젝트로 만들 에이전트는 워게임의 완전한 solve를 목표로 합니다.
  - 여러 플랫폼에서 Xss 문제를 풀다보니 alert()가 작동하는게 solve의 조건인 경우가 있었습니다. (port swigger academy)
  playwright은 alert()이 실제로 뜨는지 브라우저에서 확인할 수 있는 수단입니다.
  - 세션/쿠키 유지로 로그인이 필요한 문제 대응
  - JavaScript 오류 감지로 디버깅 가능

  2.4 **Requests** - HTTP 통신

  - 세션 유지 (GLOBAL_SESSION)
  - CSRF 토큰 자동 추출 및 갱신
  - 페이로드 반영 여부 분석

  기술 스택 다이어그램:
  ```
  ┌─────────────┐
  │   Gemini    │ ← 두뇌 (추론)
  └──────┬──────┘
         │
  ┌──────▼──────┐
  │  LangChain  │ ← 에이전트 프레임워크
  └──────┬──────┘
         │
  ┌──────▼──────────────────┐
  │   Tools (도구 모음)      │
  ├─────────────────────────┤
  │ • http_fetcher          │ ← Requests
  │ • analyze_js_sinks      │ ← Playwright
  │ • test_payload          │ ← Requests
  │ • test_stored_xss       │ ← Requests
  │ • verify_in_browser     │ ← Playwright
  │ • read_source_code      │ ← File I/O
  └─────────────────────────┘
  ```

## 3. 프로젝트 아키텍처

  3.1 **White-box, Black-box에 따른 프롬프트 및 도구 구분**

  실전 CTF는 소스 코드가 주어지는 경우도 있고, 아닌 경우도 있습니다.
  이 에이전트는 ctf-sources/ 폴더를 확인해서 자동으로 모드를 전환합니다.
```
  ctf-sources/ 폴더 체크
  ├─ 소스 파일 있음 (.py, .js, .html, .php)
  │  └─ White-box 모드
  │     - 소스 코드를 직접 분석
  │     - 필터링 로직 파악 → 정확한 우회 가능
  │
  └─ 소스 파일 없음
     └─ Black-box 모드
        - 페이로드 테스트로 필터 추측
        - 반복 시도로 우회
```

  실제 코드:
  ```py
  def detect_mode():
      if os.path.exists("ctf-sources") and 소스파일_발견:
          return "whitebox", [파일목록]
      return "blackbox", []
  ```

  ---
  3.2 **에이전트의 도구 (Tools)**

  에이전트는 6가지 도구를 사용해서 XSS를 탐지합니다.
```
  | Tool                       | Role                                            | XSS Type            |
  |----------------------------|-------------------------------------------------|---------------------|
  | `http_fetcher`             | Fetch HTML structure                            | Common              |
  | `analyze_javascript_sinks` | Detect dangerous JS functions                   | DOM XSS             |
  | `test_payload_executor`    | Inject payload into GET parameters              | Reflected XSS       |
  | `test_stored_xss`          | POST storage + Auto CSRF handling               | Stored XSS          |
  | `verify_xss_in_browser`    | Verify alert() execution with Playwright        | Final Verification  |
  | `read_source_code`         | Read source code                                | White-box only      |
```

  동작 방식:
  에이전트가 상황에 맞는 도구를 선택 → 실행 → 결과 관찰 → 다음 전략 결정

## 4. 현재 구현 상태 & 로드맵

  ✅ 완료된 기능
  - White-box/Black-box 모드
  - Reflected/Stored/DOM XSS 탐지
  - CSRF 토큰 동적 획득
  - 브라우저 기반 최종 검증
  - 세션 유지 (로그인 상태 보존)

  🚧 개선 예정
  - Stored Xss가 아니어도 Post를 위해 test_stored_xss 도구가 호출되는 현상
    - post 메소드를 위한 별도의 도구 or 프롬프트 개선
  - 에이전트가 도중에 끊기는 현상
    - 여러 모델 테스트 필요
  - Xss 테스트 케이스 부족

### 예시
![image](https://velog.velcdn.com/images/backhoe/post/28130e35-0f22-4802-ac4c-3187b0434a6c/image.png)