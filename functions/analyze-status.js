// functions/analyze-status.js
export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');

    if (!jobId) {
        return new Response(JSON.stringify({
            success: false,
            error: 'No job ID provided'
        }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }

    const job = await env.ANALYSIS_JOBS.get(jobId);

    if (!job) {
        return new Response(JSON.stringify({
            success: false,
            error: 'Job not found'
        }), {
            status: 404,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }

    return new Response(job, {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
    });
}
