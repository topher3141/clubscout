import { Browser } from "@capacitor/browser";

(async () => {
  await Browser.open({
    url: "https://clubscout-lilac.vercel.app/",
    presentationStyle: "fullscreen"
  });
})();
