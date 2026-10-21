# Аналитички радни сто — Netlify (равна структура)

Сви фајлови су у једном фолдеру. Фолдере `public` и `netlify` аутоматски прави `build.mjs` при градњи на Netlify-у.

1. GitHub: нови репозиторијум → Add file → Upload files → превуци СВЕ фајлове из овог фолдера (17 фајлова) → Commit changes.
2. Netlify: Add new site → Import an existing project → GitHub → изабери репозиторијум → Deploy. (Подешавања се читају из netlify.toml.)
3. Site configuration → Environment variables: GEMINI_API_KEY (Secret), ACCESS_TOKEN (насумично, 32+ знакова), опционо GEMINI_MODEL. Затим Deploys → Trigger deploy.
4. У апликацији: Подешавања → „Аутоматизација и сервер“ → унеси ACCESS_TOKEN → „Сачувај и повежи“. Старе податке пренеси резервном копијом (извоз/увоз).
5. У I&W означи сценарија као „Аутоматски“. Тест: „Покрени све сада“. Грешке: Netlify → Logs → Functions.

Распоред: сваког дана 04:00 UTC (05:00/06:00 по Београду).
