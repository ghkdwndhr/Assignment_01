# 🚦 Assignment_01: Traffic Light System
🎬 [**시연 영상 바로가기 클릭!**](https://youtu.be/LoRCegY1H4c?si=t3jjpntcv0HAALPH)

---

## 🧠 개요
이번 과제는 **Arduino**와 **p5.js**를 활용하여 신호등 시스템을 하드웨어와 웹 인터페이스로 제어하는 프로젝트입니다. LED, 버튼, 가변저항 등을 이용해 신호등을 구현하고, 웹에서는 슬라이더 및 버튼 UI를 통해 상태를 실시간 모니터링하고 제어할 수 있습니다.

---

## 🛠️ 주요 기능

### ✅ 신호등 제어
- 빨강, 노랑, 초록 LED를 사용하여 실제 신호등 동작 재현
- TaskScheduler를 사용하여 `delay()` 없이 비동기 제어

### 🔄 모드 전환 (버튼 & 웹 UI)
- 🔴 **Red Only**: 비상 모드 – 빨간불만 점등
- ✨ **All Blink**: 경고 모드 – 모든 LED 깜빡임
- ⛔ **All Off**: 전체 정지 – 모든 LED 꺼짐  
- 버튼 또는 웹 UI에서 토글 가능

### 🎛️ 슬라이더를 통한 점등 시간 조절 (웹 UI)
- 빨간불, 노란불, 초록불의 지속 시간을 웹 슬라이더로 설정
- 설정값은 아두이노로 전송되어 실시간 반영됨

### 🌟 밝기 조절 (하드웨어)
- 가변저항을 통해 LED의 밝기를 실시간 조절



## 🧩 하드웨어 구성도
  
📸 틴커캐드를 이용 회로 사진
  
![image](https://github.com/user-attachments/assets/6ed0030c-bfac-411e-83a2-655e16af9422)

---

### ⚡ 핀 구성

- 🔴 **Red LED**           : 핀 9  
- 🟡 **Yellow LED**        : 핀 10  
- 🟢 **Green LED**         : 핀 11  
- 🎚️ **가변저항**          : A0  
- 🔘 **버튼 1** (Red Only) : 핀 4  
- 🔘 **버튼 2** (Blink)    : 핀 5  
- 🔘 **버튼 3** (Off)      : 핀 6


## 💻 소프트웨어 구성

### Arduino (C++)
- `TaskScheduler` 라이브러리를 사용한 주기적 LED 제어
- `PinChangeInterrupt`를 통한 버튼 인터럽트 처리
- 시리얼 통신을 통해 p5.js와 데이터 송수신

### p5.js (JavaScript)
- 웹 UI 구성 (슬라이더, 버튼, 신호등 시각화)
- Serial API를 통해 아두이노와 연결 및 제어
- 아두이노로부터 실시간 상태 데이터 수신 (JSON)

- ---

## 🚀 사용 방법

1. 아두이노 보드에 코드 업로드 (PlatformIO 또는 Arduino IDE 사용)
2. 웹 브라우저에서 `p5.js` 프로젝트 실행
3. `Connect` 버튼을 눌러 포트 연결
4. 버튼 / 슬라이더 조작을 통해 신호등 제어 및 상태 확인

---

