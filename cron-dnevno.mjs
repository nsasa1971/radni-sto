// Заказана функција: сваког дана у 04:00 UTC (05:00 или 06:00 по Београду).
// Има ограничење од 30 секунди, па само покреће позадинску функцију која ради посао.
export default async () => {
  const origin = Netlify.env.get('URL');
  const token = Netlify.env.get('ACCESS_TOKEN');
  if (!origin || !token) { console.log('Нема URL или ACCESS_TOKEN.'); return; }
  const r = await fetch(origin + '/.netlify/functions/auto-run-background', {
    method: 'POST', headers: { 'x-token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ what: 'sve' }),
  });
  console.log('Покренуто, статус ' + r.status);
};
export const config = { schedule: '0 4 * * *' };
