#include <Arduino.h>
#include <TaskScheduler.h>
#include <PinChangeInterrupt.h>

const int redLedPin = 9, yellowLedPin = 10, greenLedPin = 11;
const int button1Pin = 4, button2Pin = 5, button3Pin = 6;
const int potPin = A0;

Scheduler runner;

void trafficLightTaskCallback();
void greenBlinkTaskCallback();
void blinkTaskCallback();
void sendSerialData();
void checkSerialCommand();

Task trafficLightTask(500, TASK_FOREVER, &trafficLightTaskCallback, &runner, false);
Task greenBlinkTask(167, 6, &greenBlinkTaskCallback, &runner, false);
Task blinkTask(500, TASK_FOREVER, &blinkTaskCallback, &runner, false);
Task serialTask(200, TASK_FOREVER, &sendSerialData, &runner, true);
Task commandTask(100, TASK_FOREVER, &checkSerialCommand, &runner, true);

bool redOnlyMode = false, blinkMode = false, allOff = false;
bool redState = false, yellowState = false, greenState = false;
bool blinkState = true;

unsigned long redDuration = 2000;
unsigned long yellowDuration = 500;
unsigned long greenDuration = 2000;
unsigned long previousMillis = 0;
int brightness = 255;

String mode = "Normal";
String inputBuffer = "";

void setup() {
  Serial.begin(9600);
  pinMode(redLedPin, OUTPUT);
  pinMode(yellowLedPin, OUTPUT);
  pinMode(greenLedPin, OUTPUT);

  pinMode(button1Pin, INPUT_PULLUP);
  pinMode(button2Pin, INPUT_PULLUP);
  pinMode(button3Pin, INPUT_PULLUP);

  attachPCINT(digitalPinToPCINT(button1Pin), toggleRedOnlyMode, FALLING);
  attachPCINT(digitalPinToPCINT(button2Pin), toggleBlinkMode, FALLING);
  attachPCINT(digitalPinToPCINT(button3Pin), toggleAllOffMode, FALLING);

  trafficLightTask.enable();
  serialTask.enable();
  commandTask.enable();
}

void loop() {
  runner.execute();
}

void trafficLightTaskCallback() {
  if (blinkMode || redOnlyMode || allOff) return;

  unsigned long t = millis() - previousMillis;

  if (t < redDuration) {
    analogWrite(redLedPin, brightness);
    analogWrite(yellowLedPin, 0);
    analogWrite(greenLedPin, 0);
    redState = true; yellowState = false; greenState = false;
  } else if (t < redDuration + yellowDuration) {
    analogWrite(redLedPin, 0);
    analogWrite(yellowLedPin, brightness);
    analogWrite(greenLedPin, 0);
    redState = false; yellowState = true; greenState = false;
  } else if (t < redDuration + yellowDuration + greenDuration) {
    analogWrite(redLedPin, 0);
    analogWrite(yellowLedPin, 0);
    analogWrite(greenLedPin, brightness);
    redState = false; yellowState = false; greenState = true;
  } else if (t < redDuration + yellowDuration + greenDuration + 1000) {
    greenBlinkTask.restart();
  } else {
    previousMillis = millis();
  }
}

void greenBlinkTaskCallback() {
  static int count = 0;
  blinkState = !blinkState;
  analogWrite(greenLedPin, blinkState ? brightness : 0);
  count++;
  if (count >= 6) {
    greenBlinkTask.disable();
    analogWrite(greenLedPin, brightness);
    count = 0;
  }
}

void blinkTaskCallback() {
  blinkState = !blinkState;
  analogWrite(redLedPin, blinkState ? brightness : 0);
  analogWrite(yellowLedPin, blinkState ? brightness : 0);
  analogWrite(greenLedPin, blinkState ? brightness : 0);
}

void sendSerialData() {
  String currentLight = "Off";
  if (mode == "All Blink") currentLight = "All Blinking";
  else if (mode == "Red Only") currentLight = "Red";
  else if (mode == "All Off") currentLight = "Off";
  else if (redState) currentLight = "Red";
  else if (yellowState) currentLight = "Yellow";
  else if (greenState) currentLight = "Green";

  String json = "{\"Light\":\"" + currentLight +
    "\",\"Mode\":\"" + mode +
    "\",\"Brightness\":" + String(brightness) +
    ",\"GreenBlink\":" + String(greenBlinkTask.isEnabled() ? 1 : 0) + "}";
  Serial.println(json);
}

void checkSerialCommand() {
    while (Serial.available()) {
        char c = Serial.read();
        if (c == '\n') {
            if (inputBuffer.startsWith("D:")) {
                // 모드 상태에 따라 duration만 갱신
                // 현재 모드가 Red Only, All Blink, All Off일 경우, 기존 task 상태 그대로 유지
                int r1 = inputBuffer.indexOf(':');
                int r2 = inputBuffer.indexOf(',', r1);
                int r3 = inputBuffer.indexOf(',', r2 + 1);
                if (r1 != -1 && r2 != -1 && r3 != -1) {
                    redDuration = inputBuffer.substring(r1 + 1, r2).toInt();
                    yellowDuration = inputBuffer.substring(r2 + 1, r3).toInt();
                    greenDuration = inputBuffer.substring(r3 + 1).toInt();
                }
            } else if (inputBuffer.startsWith("M:")) {
                if (inputBuffer.indexOf("Red Only") != -1) toggleRedOnlyMode();
                else if (inputBuffer.indexOf("All Blink") != -1) toggleBlinkMode();
                else if (inputBuffer.indexOf("All Off") != -1) toggleAllOffMode();
            }
            inputBuffer = "";
        } else {
            inputBuffer += c;
        }
    }
}


void toggleRedOnlyMode() {
  redOnlyMode = !redOnlyMode;
  mode = redOnlyMode ? "Red Only" : "Normal";

  if (redOnlyMode) {
    trafficLightTask.disable();
    blinkTask.disable();
    analogWrite(redLedPin, brightness);
    analogWrite(yellowLedPin, 0);
    analogWrite(greenLedPin, 0);
  } else {
    previousMillis = millis();
    trafficLightTask.enable();
  }
  sendSerialData();
}

void toggleBlinkMode() {
  blinkMode = !blinkMode;
  mode = blinkMode ? "All Blink" : "Normal";

  if (blinkMode) {
    trafficLightTask.disable();
    blinkTask.enable();
  } else {
    blinkTask.disable();
    analogWrite(redLedPin, 0);
    analogWrite(yellowLedPin, 0);
    analogWrite(greenLedPin, 0);
    previousMillis = millis();
    trafficLightTask.enable();
  }
  sendSerialData();
}

void toggleAllOffMode() {
  allOff = !allOff;
  mode = allOff ? "All Off" : "Normal";

  if (allOff) {
    trafficLightTask.disable();
    blinkTask.disable();
    analogWrite(redLedPin, 0);
    analogWrite(yellowLedPin, 0);
    analogWrite(greenLedPin, 0);
  } else {
    previousMillis = millis();
    trafficLightTask.enable();
  }
  sendSerialData();
}

