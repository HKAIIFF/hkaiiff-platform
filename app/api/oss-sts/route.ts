import { NextResponse } from 'next/server';
import OSS from 'ali-oss';

export async function GET() {
  try {
    const sts = new OSS.STS({
      accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID!,
      accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET!
    });

    const roleArn = process.env.ALIYUN_ROLE_ARN!;
    const policy = {
      Statement: [
        {
          Action: ['oss:PutObject'],
          Effect: 'Allow',
          Resource: [`acs:oss:*:*:${process.env.ALIYUN_BUCKET_NAME}/*`]
        }
      ],
      Version: '1'
    };

    // 生成有效期為 1 小時的臨時憑證
    const token = await sts.assumeRole(roleArn, policy, 3600);

    return NextResponse.json({
      AccessKeyId: token.credentials.AccessKeyId,
      AccessKeySecret: token.credentials.AccessKeySecret,
      SecurityToken: token.credentials.SecurityToken,
      Region: process.env.ALIYUN_REGION!,
      Bucket: process.env.ALIYUN_BUCKET_NAME!
    });
  } catch (error: any) {
    console.error('STS Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
