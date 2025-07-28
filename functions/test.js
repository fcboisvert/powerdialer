export async function onRequest(context) {
    return new Response("Functions are working!", {
        headers: {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*',
        },
    });
}