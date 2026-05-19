"""
AI模型适配层 - 支持多种大模型API
backend/lib/ai_client.py
"""

import os
import json
import re
from abc import ABC, abstractmethod

# ============================================================
# 抽象基类 - 所有模型都实现这个接口
# ============================================================
class BaseAIClient(ABC):
    @abstractmethod
    def chat(self, system_prompt: str, user_message: str) -> str:
        """发送消息，返回文本响应"""
        pass

# ============================================================
# 各模型实现
# ============================================================

class DeepSeekClient(BaseAIClient):
    """DeepSeek - 推荐首选，国内最便宜且效果好"""
    def __init__(self):
        from openai import OpenAI
        self.client = OpenAI(
            api_key=os.environ["DEEPSEEK_API_KEY"],
            base_url="https://api.deepseek.com"
        )
        self.model = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")

    def chat(self, system_prompt: str, user_message: str) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.1  # 低温度，格式识别任务要稳定
        )
        return response.choices[0].message.content

class QwenClient(BaseAIClient):
    """通义千问 - 阿里云，中文理解强"""
    def __init__(self):
        from openai import OpenAI
        self.client = OpenAI(
            api_key=os.environ["QWEN_API_KEY"],
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
        )
        self.model = os.environ.get("QWEN_MODEL", "qwen-plus")

    def chat(self, system_prompt: str, user_message: str) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.1
        )
        return response.choices[0].message.content

class ZhipuClient(BaseAIClient):
    """智谱GLM - 国内学术场景表现好"""
    def __init__(self):
        from openai import OpenAI
        self.client = OpenAI(
            api_key=os.environ["ZHIPU_API_KEY"],
            base_url="https://open.bigmodel.cn/api/paas/v4"
        )
        self.model = os.environ.get("ZHIPU_MODEL", "glm-4-flash")

    def chat(self, system_prompt: str, user_message: str) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.1
        )
        return response.choices[0].message.content

class MoonshotClient(BaseAIClient):
    """月之暗面Kimi - 长文本处理强，适合长论文"""
    def __init__(self):
        from openai import OpenAI
        self.client = OpenAI(
            api_key=os.environ["MOONSHOT_API_KEY"],
            base_url="https://api.moonshot.cn/v1"
        )
        self.model = os.environ.get("MOONSHOT_MODEL", "moonshot-v1-8k")

    def chat(self, system_prompt: str, user_message: str) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.1
        )
        return response.choices[0].message.content

class ClaudeClient(BaseAIClient):
    """Anthropic Claude - 效果最好但最贵，备用"""
    def __init__(self):
        import anthropic
        self.client = anthropic.Anthropic(
            api_key=os.environ["ANTHROPIC_API_KEY"]
        )
        self.model = os.environ.get("CLAUDE_MODEL", "claude-haiku-4-5-20251001")

    def chat(self, system_prompt: str, user_message: str) -> str:
        message = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}]
        )
        return message.content[0].text

class OpenAIClient(BaseAIClient):
    """OpenAI - 海外可用"""
    def __init__(self):
        from openai import OpenAI
        self.client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        self.model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

    def chat(self, system_prompt: str, user_message: str) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.1
        )
        return response.choices[0].message.content

# ============================================================
# 工厂函数 - 根据环境变量选择模型
# ============================================================
def get_ai_client() -> BaseAIClient:
    provider = os.environ.get("AI_PROVIDER", "deepseek").lower()
    clients = {
        "deepseek": DeepSeekClient,
        "qwen":     QwenClient,
        "zhipu":    ZhipuClient,
        "moonshot": MoonshotClient,
        "claude":   ClaudeClient,
        "openai":   OpenAIClient,
    }
    if provider not in clients:
        raise ValueError(f"不支持的AI提供商: {provider}，可选: {list(clients.keys())}")
    return clients[provider]()

# ============================================================
# 段落识别核心函数
# ============================================================
SYSTEM_PROMPT = """你是一个专业的学术论文格式分析助手。
你的任务是识别论文段落的类型，必须从以下类型中选择一个：

- h1: 一级标题（如"第1章 绪论"）
- h2: 二级标题（如"1.1 研究背景"）
- h3: 三级标题（如"1.1.1 研究现状"）
- abstract: 摘要正文
- body: 正文段落
- ref: 参考文献条目
- caption: 图表题注（图X-X或表X-X开头）
- cover: 封面信息（题目、姓名、学号等）
- toc: 目录内容
- keywords: 关键词行
- conclusion: 总结/结论部分正文

必须返回合法的JSON，格式如下，不要有任何其他文字：
{"type": "body", "confidence": 0.95, "reason": "正文段落，首行缩进，内容为研究描述"}"""

def classify_paragraphs(paragraphs: list[dict]) -> list[dict]:
    """
    对段落列表进行分类识别
    paragraphs: [{"index": 0, "text": "..."}, ...]
    返回: [{"index": 0, "text": "...", "type": "body", "confidence": 0.95}, ...]
    """
    client = get_ai_client()
    results = []

    for para in paragraphs:
        text = para["text"].strip()
        if not text:
            results.append({**para, "type": "body", "confidence": 1.0})
            continue

        user_message = f"请识别以下段落的类型：\n\n{text[:500]}"

        try:
            response = client.chat(SYSTEM_PROMPT, user_message)
            # 清理响应，防止模型输出多余内容
            response = response.strip()
            if "```" in response:
                response = re.search(r'\{.*\}', response, re.DOTALL).group()
            data = json.loads(response)
            results.append({
                **para,
                "type": data.get("type", "body"),
                "confidence": float(data.get("confidence", 0.5)),
                "reason": data.get("reason", "")
            })
        except Exception as e:
            results.append({
                **para,
                "type": "body",
                "confidence": 0.3,
                "reason": f"识别失败: {str(e)}"
            })

    return results

