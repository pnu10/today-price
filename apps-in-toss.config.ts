import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  // ⚠️ 배포(ait deploy)용 식별자 — 앱인토스 콘솔에 등록한 값과 같아야 합니다.
  //    사용자에게 보이는 이름("오늘만 이 가격")과 아이콘은 SDK 3.x부터
  //    이 파일이 아니라 콘솔에서 관리해요. 여기 값은 바꿀 필요 없습니다.
  //    최저가픽(lowest-pick)과는 별개의 앱이라 콘솔에 새로 등록해야 합니다.
  appName: "today-price",

  brand: {
    primaryColor: "#DDFF55",
  },

  // 카메라·위치·연락처 등 기기 권한을 쓰지 않아요.
  permissions: [],

  webBundleDir: "dist",
});
