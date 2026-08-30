import { TaskItem, Difficulty, Priority } from '../types';

export interface DecomposedQuest {
  title: string;
  subtasks: { id: string; text: string; completed: boolean }[];
  difficulty: Difficulty;
  priority: Priority;
  durationMinutes: number;
  expReward: number;
  goldReward: number;
  rpgLore: string;
}

export async function decomposeTaskWithAi(
  taskTitle: string,
  apiKey?: string
): Promise<DecomposedQuest[]> {
  // If API key is provided, we can query Gemini API
  if (apiKey) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are an RPG Quest Master in a gamified productivity app. The user has a major real-world task: "${taskTitle}".
Break this down into 3 sequential, actionable micro-quests.
Return ONLY valid JSON in this exact structure without markdown backticks:
[
  {
    "title": "Short punchy quest name",
    "subtasks": ["Step 1", "Step 2", "Step 3"],
    "difficulty": "easy" | "medium" | "hard" | "epic",
    "priority": "p1" | "p2" | "p3",
    "durationMinutes": 25,
    "expReward": 50,
    "goldReward": 30,
    "rpgLore": "Motivational RPG flavor text"
  }
]`
            }]
          }]
        })
      });

      if (response.ok) {
        const json = await response.json();
        const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return parsed.map((item: any) => ({
          ...item,
          subtasks: (item.subtasks || []).map((t: string, idx: number) => ({
            id: `st-ai-${Date.now()}-${idx}`,
            text: t,
            completed: false,
          })),
        }));
      }
    } catch (e) {
      console.warn('Gemini API call failed, falling back to heuristic quest master', e);
    }
  }

  // Smart Heuristic Fallback Generator
  return [
    {
      title: `⚔️ [Этап 1: Разведка] Собрать материалы: ${taskTitle.slice(0, 35)}`,
      subtasks: [
        { id: `st-ai-1`, text: 'Выписать ключевые тезисы и структуру', completed: false },
        { id: `st-ai-2`, text: 'Подготовить рабочее пространство и ссылки', completed: false },
      ],
      difficulty: 'easy',
      priority: 'p2',
      durationMinutes: 20,
      expReward: 35,
      goldReward: 20,
      rpgLore: 'Первый шаг — половина битвы. Разведка карты открывает путь к победе!',
    },
    {
      title: `⚡ [Этап 2: Основной Штурм] Реализация: ${taskTitle.slice(0, 35)}`,
      subtasks: [
        { id: `st-ai-3`, text: 'Сфокусироваться на главном результате без отвлечений', completed: false },
        { id: `st-ai-4`, text: 'Сделать черновой рабочий вариант', completed: false },
      ],
      difficulty: 'hard',
      priority: 'p1',
      durationMinutes: 45,
      expReward: 80,
      goldReward: 50,
      rpgLore: 'Могучий удар по прокрастинации. Нанеси сокрушительный урон боссу!',
    },
    {
      title: `🏆 [Этап 3: Полировка и Сдача] Финализация: ${taskTitle.slice(0, 35)}`,
      subtasks: [
        { id: `st-ai-5`, text: 'Проверить детали и устранить шероховатости', completed: false },
        { id: `st-ai-6`, text: 'Зафиксировать успех и забрать награду в Таверне', completed: false },
      ],
      difficulty: 'medium',
      priority: 'p3',
      durationMinutes: 25,
      expReward: 45,
      goldReward: 30,
      rpgLore: 'Победный триумф! Закрой квест и получи золото.',
    },
  ];
}
