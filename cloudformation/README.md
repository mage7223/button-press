# cloudformation

CloudFormation stack `button-press-cdn` (region `us-east-1`) manages the 2
CloudFront distributions for button-press.com — created directly via CLI on
2026-08-09, then **imported** into this stack (not recreated) so they're
under IaC management without having been torn down and rebuilt. See
`../SPEC.md` §15 for the full deployment picture and why this project
doesn't use Terraform.

## What this stack owns (and what it doesn't)

Owned — managed by `button-press-cdn.yaml`:
- `StagingDistribution` (`E30NVLWVF1DEWB`, `dev.button-press.com`)
- `ProductionDistribution` (`E294FWDQR4JR8D`, `button-press.com` + `www.button-press.com`)

**Not** owned — these are shared with ~10 other personal sites and stay
hand-managed outside this stack, referenced only by ARN/ID as template
parameters:
- the `kjr-static-content` S3 bucket and its bucket policy
- the Origin Access Identity (`E8XZ915T7W6UI`)
- the ACM certificate
- the Route53 hosted zone and its records (`button-press.com`,
  `www.button-press.com`, `dev.button-press.com` A/AAAA aliases)
- the `static-deploy-user` IAM user

## Rollback / safety

Both resources have `DeletionPolicy: Retain` and `UpdateReplacePolicy:
Retain`. That means:
- **`aws cloudformation delete-stack --stack-name button-press-cdn`**
  removes the stack's *bookkeeping* but leaves both distributions running
  untouched — a safe way to "undo" CloudFormation management without
  taking the site down.
- To actually let the stack delete/replace the distributions (e.g. you
  genuinely want `delete-stack` to tear them down), change
  `DeletionPolicy`/`UpdateReplacePolicy` to `Delete` first via a stack
  update, then delete.
- Any future config drift (e.g. someone hand-edits a distribution in the
  console) can be checked with `aws cloudformation detect-stack-drift` and
  corrected by updating the template and running a normal change set.

## Making changes

```bash
aws cloudformation create-change-set \
  --stack-name button-press-cdn \
  --change-set-name <describe-the-change> \
  --template-body file://button-press-cdn.yaml
aws cloudformation describe-change-set --stack-name button-press-cdn --change-set-name <name>   # review before executing
aws cloudformation execute-change-set --stack-name button-press-cdn --change-set-name <name>
```

## How the import was done (for reference, not something to repeat)

1. Wrote `button-press-cdn.yaml` to exactly match the already-live
   distributions' configs (pulled via `aws cloudfront
   get-distribution-config` to guarantee a property match — a mismatch
   would have made the import change set fail validation).
2. Import change sets can't include an `Outputs` section on the initial
   import, so the import ran against a template with `Outputs` stripped:
   ```bash
   aws cloudformation create-change-set \
     --stack-name button-press-cdn \
     --change-set-name import-existing-distributions \
     --change-set-type IMPORT \
     --resources-to-import file://resources-to-import.json \
     --template-body file://button-press-cdn-no-outputs.yaml
   aws cloudformation execute-change-set --stack-name button-press-cdn --change-set-name import-existing-distributions
   ```
   where `resources-to-import.json` was:
   ```json
   [
     { "ResourceType": "AWS::CloudFront::Distribution", "LogicalResourceId": "StagingDistribution", "ResourceIdentifier": { "Id": "E30NVLWVF1DEWB" } },
     { "ResourceType": "AWS::CloudFront::Distribution", "LogicalResourceId": "ProductionDistribution", "ResourceIdentifier": { "Id": "E294FWDQR4JR8D" } }
   ]
   ```
3. A second, ordinary change set (type `UPDATE`) against the full template
   (with `Outputs` restored) added the outputs — CloudFormation reported
   zero resource changes for that step, confirming the import was a clean,
   no-drift adoption.

## Why Route53 records aren't in this stack

`AWS::Route53::RecordSet` import support/identifier format wasn't
something we had high confidence in without live testing, and the 6 alias
records (3 hostnames × A/AAAA) are small, low-churn, and already documented
in `SPEC.md` §15.6/§15.8. Bringing the 2 distributions under IaC gets most
of the value (they're the resource where an accidental delete/replace
would actually be painful — a new distribution means a new
`*.cloudfront.net` domain and requires touching DNS anyway). Importing the
DNS records too is a reasonable follow-up if it turns out to matter.
