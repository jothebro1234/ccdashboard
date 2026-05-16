export async function onRequestGet(context) {
    const { request, env } = context;
    const sheetId = env.SHEET_ID;
    if (!sheetId) return new Response('Server misconfigured', { status: 500 });

    const url = new URL(request.url);
    const sheetName = url.searchParams.get('name') || '';
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

    const res = await fetch(gvizUrl, { redirect: 'follow' });
    const text = await res.text();
    return new Response(text, {
        status: res.ok ? 200 : res.status,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
}
