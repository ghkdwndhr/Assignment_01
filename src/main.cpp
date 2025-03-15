#include <Arduino.h>
#include <TaskScheduler.h>
#include <PinChangeInterrupt.h>  // ✅ 핀체인지 인터럽트 라이브러리 추가

// 🔹 핀 설정
const int ledPinRed = 9;
const int ledPinYellow = 10;
const int ledPinBlue = 11;
const int button1 = 4;  // 버튼1 -> 빨간불만 켜지는 기능
const int button2 = 5;  // 버튼2 -> 깜빡이기 모드
const int button3 = 6;
const int potSensor = A0;  // ✅ 가변 저항 입력 핀

// 🔹 TaskScheduler 객체 생성
Scheduler taskScheduler;

// 🔹 Task 함수 선언
void lightControlTaskCallback();
void blueLedBlinkTaskCallback();
void blinkLedTaskCallback();
void adjustLedBrightnessTaskCallback();  // ✅ 밝기 조절 Task

// 🔹 인터럽트 핸들러 함수 선언
void switchToBlinkMode();
void switchToRedOnlyMode();
void switchOffAllLeds();

// 🔹 Task 객체 생성
Task lightControlTask(500, TASK_FOREVER, &lightControlTaskCallback, &taskScheduler, false);
Task blueLedBlinkTask(167, 6, &blueLedBlinkTaskCallback, &taskScheduler, false);  // 🔹 167ms 간격으로 6번 깜빡이기
Task blinkLedTask(500, TASK_FOREVER, &blinkLedTaskCallback, &taskScheduler, false);
Task adjustLedBrightnessTask(10, TASK_FOREVER, &adjustLedBrightnessTaskCallback, &taskScheduler, true);  // ✅ 밝기 조절 Task (10ms마다 갱신)

// 🔹 상태 변수
volatile bool isBlinkMode = false;
volatile bool isRedOnlyMode = false;
volatile bool areAllLedsOff = false;
bool ledBlinkState = true;
bool isBlueBlinkActive = false;
int currentBrightness = 255;  // ✅ 초기 LED 밝기 (최대)

// 🔹 신호등 점등 시간
const long redLightTime = 2000;
const long yellowLightTime = 500;
const long blueLightTime = 3000;
const long extraYellowLightTime = 500;
unsigned long previousTime = 0;

void setup() {
    Serial.begin(9600);

    pinMode(ledPinRed, OUTPUT);
    pinMode(ledPinYellow, OUTPUT);
    pinMode(ledPinBlue, OUTPUT);
    pinMode(potSensor, INPUT);  // ✅ 가변저항 핀 설정

    pinMode(button1, INPUT_PULLUP);  // 버튼1
    pinMode(button2, INPUT_PULLUP);  // 버튼2
    pinMode(button3, INPUT_PULLUP);

    // ✅ 핀체인지 인터럽트 설정
    attachPCINT(digitalPinToPCINT(button1), switchToRedOnlyMode, FALLING);  // 버튼1 -> 빨간불만 켜기
    attachPCINT(digitalPinToPCINT(button2), switchToBlinkMode, FALLING);  // 버튼2 -> 깜빡이기 모드
    attachPCINT(digitalPinToPCINT(button3), switchOffAllLeds, FALLING);

    // ✅ 초기 신호등 동작 보장
    previousTime = millis();
    lightControlTask.enable();  // 신호등 시작
    adjustLedBrightnessTask.enable();  // 밝기 조절 Task 시작
}

void loop() {
    taskScheduler.execute();
}

// 🔹 **가변저항 값을 읽어 LED 밝기 조절**
void adjustLedBrightnessTaskCallback() {
    int sensorValue = analogRead(potSensor);  // 가변저항 값 읽기 (0~1023)
    currentBrightness = map(sensorValue, 0, 1023, 0, 255);  // 0~255로 변환

    // ✅ 디버깅 메시지 추가
    Serial.print("Potentiometer Value: ");
    Serial.print(sensorValue);
    Serial.print(" -> Mapped Brightness: ");
    Serial.println(currentBrightness);
}

// 🔹 신호등 Task
void lightControlTaskCallback() {
    if (isBlinkMode || isRedOnlyMode || areAllLedsOff) return;

    unsigned long elapsedTime = millis() - previousTime;

    if (elapsedTime < redLightTime) {  
        analogWrite(ledPinRed, currentBrightness);
        analogWrite(ledPinYellow, 0);
        analogWrite(ledPinBlue, 0);
        isBlueBlinkActive = false;
    } 
    else if (elapsedTime < redLightTime + yellowLightTime) {  
        analogWrite(ledPinRed, 0);
        analogWrite(ledPinYellow, currentBrightness);
        analogWrite(ledPinBlue, 0);
        isBlueBlinkActive = false;
    } 
    else if (elapsedTime < redLightTime + yellowLightTime + blueLightTime) {  
        if (elapsedTime < redLightTime + yellowLightTime + (blueLightTime - 1000)) {
            analogWrite(ledPinBlue, currentBrightness);
            analogWrite(ledPinRed, 0);
            analogWrite(ledPinYellow, 0);
            isBlueBlinkActive = false;
        }
        else if (!isBlueBlinkActive) {  
            isBlueBlinkActive = true;
            blueLedBlinkTask.restart();  // 🔹 깜빡이는 Task 시작
        }
    }
    else if (elapsedTime < redLightTime + yellowLightTime + blueLightTime + extraYellowLightTime) {  
        analogWrite(ledPinRed, 0);
        analogWrite(ledPinYellow, currentBrightness);
        analogWrite(ledPinBlue, 0);
        isBlueBlinkActive = false;
    } 
    else {
        previousTime = millis();  // 🔄 주기 리셋
    }
}

// 🔹 **파란불 깜빡이기 Task**
void blueLedBlinkTaskCallback() {
    ledBlinkState = !ledBlinkState;
    analogWrite(ledPinBlue, ledBlinkState ? currentBrightness : 0);
    Serial.println(ledBlinkState ? "Blue LED ON" : "Blue LED OFF");

    if (blueLedBlinkTask.isLastIteration()) {
        analogWrite(ledPinBlue, currentBrightness);
    }
}

// 🔹 깜빡이기 Task (버튼 2 - 깜빡이기 모드)
void blinkLedTaskCallback() {
    static bool ledState = false;
    if (isBlinkMode) {
        ledState = !ledState;
        analogWrite(ledPinRed, ledState ? currentBrightness : 0);
        analogWrite(ledPinYellow, ledState ? currentBrightness : 0);
        analogWrite(ledPinBlue, ledState ? currentBrightness : 0);
    }
}

// 🔹 인터럽트 핸들러 (버튼 1, 2, 3)
void switchToRedOnlyMode() {
    isRedOnlyMode = !isRedOnlyMode;
    Serial.println(isRedOnlyMode ? "Red Only Mode ON" : "Red Only Mode OFF");
    if (isRedOnlyMode) {
        lightControlTask.disable();
        blinkLedTask.disable();
        analogWrite(ledPinRed, currentBrightness);
        analogWrite(ledPinYellow, 0);
        analogWrite(ledPinBlue, 0);
    } else {
        previousTime = millis();
        lightControlTask.enable();
    }
}

void switchToBlinkMode() {
    isBlinkMode = !isBlinkMode;
    Serial.println(isBlinkMode ? "Blink Mode ON" : "Blink Mode OFF");
    if (isBlinkMode) {
        lightControlTask.disable();
        blinkLedTask.enable();
    } else {
        blinkLedTask.disable();
        previousTime = millis();
        lightControlTask.enable();
    }
}

void switchOffAllLeds() {
    areAllLedsOff = !areAllLedsOff;
    Serial.println(areAllLedsOff ? "All LEDs Off" : "Traffic Light Mode ON");
    if (areAllLedsOff) {
        lightControlTask.disable();
        blinkLedTask.disable();
        analogWrite(ledPinRed, 0);
        analogWrite(ledPinYellow, 0);
        analogWrite(ledPinBlue, 0);
    } else {
        analogWrite(ledPinRed, currentBrightness);
        analogWrite(ledPinYellow, 0);
        analogWrite(ledPinBlue, 0);
        previousTime = millis();
        lightControlTask.enable();
    }
}
