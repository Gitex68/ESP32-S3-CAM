#include <WiFi.h>
#include <HTTPClient.h>
#include <esp_camera.h>
#include "SD_MMC.h"
#include "FS.h"
#include "SPI.h"
#include "esp_sleep.h"

// =========================
// WIFI
// =========================
const char* ssid = "";
const char* password = "";

// =========================
// SERVEUR
// =========================
const char* serverUrl = "http://192.168.1.157:5000/upload";

// =========================
// CAMÉRA OV5640 PINS
// =========================
#define PWDN_GPIO_NUM     -1
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      15
#define SIOD_GPIO_NUM       4
#define SIOC_GPIO_NUM       5
#define Y9_GPIO_NUM        16
#define Y8_GPIO_NUM        17
#define Y7_GPIO_NUM        18
#define Y6_GPIO_NUM        12
#define Y5_GPIO_NUM        10
#define Y4_GPIO_NUM         8
#define Y3_GPIO_NUM         9
#define Y2_GPIO_NUM        11
#define VSYNC_GPIO_NUM      6
#define HREF_GPIO_NUM       7
#define PCLK_GPIO_NUM      13

// =========================
// CAPTEURS
// =========================
#define LM393_PIN 21
#define PIR_PIN   14

// =========================
// DEEPSLEEP
// =========================
void enterDeepSleep() {
  Serial.println("➡️ Passage en DeepSleep");
  esp_sleep_enable_ext0_wakeup((gpio_num_t)PIR_PIN, 1);
  delay(200);
  esp_deep_sleep_start();
}

// =========================
// UPLOAD D’UN FICHIER
// =========================
bool uploadFile(const char* path) {
  File file = SD_MMC.open(path);
  if (!file) return false;

  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "image/jpeg");

  int code = http.sendRequest("POST", &file, file.size());
  http.end();
  file.close();

  if (code > 0 && code < 300) {
    Serial.println("✅ Upload OK : " + String(path));
    SD_MMC.remove(path);
    return true;
  }

  Serial.println("❌ Upload FAIL : " + String(path));
  return false;
}

// =========================
// ENVOI DES PHOTOS EN ATTENTE
// =========================
void sendBufferedPhotos() {
  File dir = SD_MMC.open("/buffer");
  if (!dir) return;

  File file;
  while ((file = dir.openNextFile())) {
    if (!file.isDirectory()) {
      String path = "/buffer/" + String(file.name());
      file.close();
      if (!uploadFile(path.c_str())) break;
    }
  }
  dir.close();
}

// =========================
// INITIALISATION SD FIXE
// =========================
bool initSD() {
  SD_MMC.end();
  SD_MMC.setPins(39, 38, 40);

  if (!SD_MMC.begin("/sdcard", true)) {
    return false;
  }

  SD_MMC.mkdir("/buffer");  // assure que le dossier existe
  return true;
}

// =========================
// SETUP
// =========================
void setup() {
  Serial.begin(115200);
  delay(800);

  pinMode(PIR_PIN, INPUT);
  pinMode(LM393_PIN, INPUT);

  // Initialisation SD
  if (!initSD()) {
    enterDeepSleep();
  }

  // Réveil PIR ?
  if (esp_sleep_get_wakeup_cause() != ESP_SLEEP_WAKEUP_EXT0) {
    enterDeepSleep();
  }

  // Nuit ?
  if (digitalRead(LM393_PIN) == 1) {
    enterDeepSleep();
  }

  // =========================
  // CAMÉRA
  // =========================
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_VGA;
  config.jpeg_quality = 10;
  config.fb_count = 1;

  if (esp_camera_init(&config) != ESP_OK) {
    Serial.println("❌ Erreur caméra");
    enterDeepSleep();
  }

  // =========================
  // PHOTO IMMÉDIATE
  // =========================
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) enterDeepSleep();

  String filename = "/buffer/photo_" + String(millis()) + ".jpg";
  File file = SD_MMC.open(filename, FILE_WRITE);
  file.write(fb->buf, fb->len);
  file.close();
  esp_camera_fb_return(fb);

  // =========================
  // WIFI + UPLOAD
  // =========================
  WiFi.begin(ssid, password);
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 8000) delay(200);

  if (WiFi.status() == WL_CONNECTED) {
    sendBufferedPhotos();
  }

  enterDeepSleep();
}

// =========================
// LOOP
// =========================
void loop() {}
