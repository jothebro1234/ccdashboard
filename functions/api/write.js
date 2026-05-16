export async function onRequestPost(context) {
    const { request, env } = context;
    const scriptUrl = env.APPS_SCRIPT_URL;
    if (!scriptUrl) return new Response('Server misconfigured', { status: 500 });

    const body = await request.text();
    const res = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body,
        redirect: 'follow',
    });
    const text = await res.text();
    return new Response(text, {
        status: res.ok ? 200 : res.status,
        headers: { 'Content-Type': 'application/json' },
    });
}
