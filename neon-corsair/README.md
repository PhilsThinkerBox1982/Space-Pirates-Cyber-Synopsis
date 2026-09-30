# Neon Corsair

A single-page space-pirate arcade game. Collect cyan data shards, dodge orange mines, and survive the 45-second nebula run.

## Play locally

```sh
npm install
npm run dev
```

Steer with **← / →** or **A / D**. On touch screens, use the on-screen arrow buttons. Press **P** or **Escape** to pause. Your best run is saved in your browser.

## Production build

```sh
npm run build
npm run preview
```

The static production site is generated in `dist/`.

## Deploy to AWS

The CloudFormation template provisions a private, encrypted S3 bucket and a CloudFront distribution with HTTPS redirection, origin access control, and browser security headers. The bucket is retained if the stack is deleted.

1. Build a deployment bundle:

   ```sh
   npm run bundle:aws
   ```

2. Sign in to the AWS Console, select **us-east-1**, and open **CloudShell**.
3. In CloudShell, choose **Actions → Upload file** and upload `neon-corsair-aws-deploy.zip`.
4. Run:

   ```sh
   unzip -o neon-corsair-aws-deploy.zip -d neon-corsair
   cd neon-corsair
   bash deploy.sh
   ```

CloudShell uses the signed-in AWS identity. It needs permission to create and update the stack and its S3 and CloudFront resources. The script prints the public game URL when deployment completes. Subsequent runs update the same stack and site; set `STACK_NAME` to use a different stack name.

S3 storage/requests and CloudFront requests/data transfer may incur AWS charges. The distribution uses the `PriceClass_100` edge-location group. Deleting the stack intentionally retains the S3 bucket and game files; empty and delete that bucket separately if you want to remove all related storage.
