"""
短信发送适配层
backend/lib/sms.py

SMS_PROVIDER=aliyun → 阿里云短信（需另行安装 alibabacloud-dysmsapi20170525）
SMS_PROVIDER=mock   → 控制台打印验证码，不发真实短信（开发/测试）

阿里云短信所需环境变量：
  ALIYUN_ACCESS_KEY_ID
  ALIYUN_ACCESS_KEY_SECRET
  ALIYUN_SMS_SIGN_NAME      短信签名（须在阿里云审核通过）
  ALIYUN_SMS_TEMPLATE_CODE  短信模板 CODE，模板内容示例：验证码${code}，5分钟内有效。
"""
import os
import random
import logging

logger = logging.getLogger("thesis.sms")


def _make_code() -> str:
    return str(random.randint(100000, 999999))


def _send_aliyun(phone: str, code: str) -> None:
    try:
        from alibabacloud_dysmsapi20170525.client import Client
        from alibabacloud_dysmsapi20170525 import models as sms_models
        from alibabacloud_tea_openapi import models as open_api_models
    except ImportError as e:
        raise RuntimeError(
            "阿里云短信 SDK 未安装，请执行: "
            "pip install alibabacloud-dysmsapi20170525"
        ) from e

    config = open_api_models.Config(
        access_key_id=os.environ["ALIYUN_ACCESS_KEY_ID"],
        access_key_secret=os.environ["ALIYUN_ACCESS_KEY_SECRET"],
    )
    config.endpoint = "dysmsapi.aliyuncs.com"
    client = Client(config)
    req = sms_models.SendSmsRequest(
        phone_numbers=phone,
        sign_name=os.environ["ALIYUN_SMS_SIGN_NAME"],
        template_code=os.environ["ALIYUN_SMS_TEMPLATE_CODE"],
        template_param=f'{{"code":"{code}"}}',
    )
    resp = client.send_sms(req)
    if resp.body.code != "OK":
        raise RuntimeError(f"短信发送失败: {resp.body.message}（Code: {resp.body.code}）")
    logger.info("短信已发送至 %s***%s", phone[:3], phone[-4:])


def send_verification_code(phone: str) -> str:
    """生成6位验证码并发送，返回验证码（供调用方存入数据库）。"""
    code = _make_code()
    provider = os.environ.get("SMS_PROVIDER", "mock").strip().lower()
    if provider == "aliyun":
        _send_aliyun(phone, code)
    else:
        logger.warning("[MOCK SMS] 手机号=%s  验证码=%s  （未发送真实短信）", phone, code)
    return code
