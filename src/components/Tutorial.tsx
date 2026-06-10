import React, { useState } from 'react';

interface TutorialProps {
  onComplete: () => void;
}

const TUTORIAL_STEPS = [
  {
    title: '🃏 欢迎来到德州扑克训练!',
    content: '这是一个帮助你学习德州扑克的训练应用。接下来我们会快速介绍基本规则。',
    image: '🂡',
  },
  {
    title: '🎴 游戏目标',
    content: '德州扑克的目标是用你的2张手牌和5张公共牌组成最强的5张牌型，赢取底池中的所有筹码。',
    image: '🏆',
  },
  {
    title: '📍 位置与盲注',
    content: '每手牌开始前，两个玩家必须下"盲注"——小盲(SB)和大盲(BB)。庄家按钮(D)按顺时针轮转。位置越靠后，信息优势越大。',
    image: '💺',
  },
  {
    title: '🔄 游戏流程',
    content: '每手牌经历4个阶段：\n\n1. 翻牌前 — 每人获得2张手牌\n2. 翻牌 — 发3张公共牌\n3. 转牌 — 发第4张公共牌\n4. 河牌 — 发第5张公共牌\n\n每个阶段后你都可以：弃牌、过牌/跟注、加注',
    image: '🔄',
  },
  {
    title: '🃏 牌型大小 (从强到弱)',
    content: '皇家同花顺 > 同花顺 > 四条 > 葫芦 > 同花 > 顺子 > 三条 > 两对 > 一对 > 高牌\n\n你可以在游戏中随时点击右上角的 📋 按钮查看牌型参考。',
    image: '💪',
  },
  {
    title: '📊 关键概念：底池赔率',
    content: '底池赔率 = 需要跟注的金额 / (底池 + 跟注金额)\n\n如果赢率 > 底池赔率，跟注就是正期望值(+EV)。游戏会帮你实时计算这些数据。',
    image: '📊',
  },
  {
    title: '🎯 准备好了吗？',
    content: '游戏中你会看到：\n\n• 📌 GTO建议 — 告诉你最优策略\n• 📊 底池赔率 & 出牌 — 帮你做决策\n• 📝 行动记录 — 回顾每手牌的经过\n• 🎯 手牌测验 — 随时进入练习模式\n\n祝你学习愉快！',
    image: '🚀',
  },
];

const Tutorial: React.FC<TutorialProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const current = TUTORIAL_STEPS[step];
  const isFirst = step === 0;
  const isLast = step === TUTORIAL_STEPS.length - 1;

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-panel">
        <div className="tutorial-image">{current.image}</div>
        <h2 className="tutorial-title">{current.title}</h2>
        <div className="tutorial-content">
          {current.content.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        <div className="tutorial-dots">
          {TUTORIAL_STEPS.map((_, i) => (
            <span key={i} className={`tutorial-dot${i === step ? ' active' : ''}`} />
          ))}
        </div>
        <div className="tutorial-actions">
          {!isFirst && (
            <button className="btn btn-tutorial-prev" onClick={() => setStep(step - 1)}>
              ← 上一步
            </button>
          )}
          {!isFirst && (
            <button className="btn btn-tutorial-skip" onClick={onComplete}>
              跳过教程
            </button>
          )}
          {isLast ? (
            <button className="btn btn-start" onClick={onComplete}>
              开始游戏! 🎮
            </button>
          ) : (
            <button className="btn btn-tutorial-next" onClick={() => setStep(step + 1)}>
              下一步 →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Tutorial;
