// OG 이미지 만들기: 사이트 히어로를 1200x630으로 캡처한 뒤 문구·주소 배지를 얹어 og-image.jpg 로 저장
// 사용: python3 serve.py 를 켠 상태에서  node scripts/make-og-image.js og-image.jpg   (전역 playwright + Chrome 필요)
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs = require('fs');
const OUT = process.argv[2];
const DIR = require('os').tmpdir();
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
  await page.goto('http://localhost:5180/', { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '.hero-hint,.hero-cta,.hero .lead{visibility:hidden!important}' });
  await page.waitForTimeout(7000); // 친구들이 떨어져서 자리 잡을 때까지
  await page.screenshot({ path: `${DIR}/shot.png` });

  const bg = fs.readFileSync(`${DIR}/shot.png`).toString('base64');
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Jua&display=swap" rel="stylesheet">
  <style>
    *{margin:0;box-sizing:border-box}
    body{width:1200px;height:630px;position:relative;overflow:hidden;font-family:'Jua',sans-serif;color:#3a2e5c}
    img{position:absolute;inset:0;width:1200px;height:630px}
    .card{position:absolute;left:52px;bottom:44px;background:#fffdf6;border:4px solid #3a2e5c;border-radius:22px;
      padding:14px 24px;font-size:30px;box-shadow:0 6px 0 #3a2e5c}
    .card b{color:#ff6f9c;font-weight:400}
    .url{position:absolute;right:44px;bottom:50px;background:#ffd45c;border:4px solid #3a2e5c;border-radius:999px;
      padding:10px 22px;font-size:24px;box-shadow:0 5px 0 #3a2e5c}
  </style></head><body>
    <img src="data:image/png;base64,${bg}">
    <div class="card">앱 · 영상 · 동요로 만나는 <b>코코비와 친구들</b></div>
    <div class="url">kg-deploy1-wheat.vercel.app</div>
  </body></html>`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: OUT, type: 'jpeg', quality: 88, scale: 'css' });
  await browser.close();
})();
