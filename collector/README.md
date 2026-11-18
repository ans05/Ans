# AFTERHOURS collector

Tiny AWS backend that receives the usage events sent by the app.
Lambda Function URL -> validates against an allowlist -> DynamoDB (pay per request).

```bash
node --test collector/handler.test.mjs   # local tests, no AWS needed
sam build && sam deploy --guided         # deploy (needs AWS credentials)
```

After deploying, set repo variables `VITE_ANALYTICS_ENDPOINT` (the FunctionUrl)
and optionally `VITE_FEEDBACK_URL` (a form link), then re-run the Pages deploy.
Concurrency is capped at 5 to bound cost and abuse.
