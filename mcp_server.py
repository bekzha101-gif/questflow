#!/usr/bin/env python3
"""
QuestFlow Model Context Protocol (MCP) Server
Integrates QuestFlow RPG & Todoist & ShortsFlow task manager with AI Agents.
"""

import sys
import json
import os
from typing import Dict, Any, List

STORAGE_PATH = os.path.expanduser("~/.questflow_data.json")

def load_data() -> Dict[str, Any]:
    if os.path.exists(STORAGE_PATH):
        try:
            with open(STORAGE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "stats": {
            "level": 4,
            "exp": 240,
            "maxExp": 400,
            "hp": 85,
            "maxHp": 100,
            "gold": 175,
            "streak": 5,
            "heroClass": "Mage",
            "title": "Мастер Фокуса"
        },
        "tasks": []
    }

def save_data(data: Dict[str, Any]):
    with open(STORAGE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

TOOLS = [
    {
        "name": "get_hero_stats",
        "description": "Get current hero level, HP, EXP, Gold, and Streak in QuestFlow RPG.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "add_quest",
        "description": "Create a new RPG quest / Todoist task with rewards and Google Calendar sync.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Quest title"},
                "priority": {"type": "string", "enum": ["p1", "p2", "p3", "p4"], "description": "Priority level"},
                "due_date": {"type": "string", "description": "Due date (YYYY-MM-DD)"},
                "due_time": {"type": "string", "description": "Due time (HH:mm)"},
                "duration_minutes": {"type": "integer", "description": "Estimated duration in minutes"},
                "tags": {"type": "array", "items": {"type": "string"}, "description": "Tags or categories"},
                "exp_reward": {"type": "integer", "description": "EXP reward for completion"},
                "gold_reward": {"type": "integer", "description": "Gold reward for completion"}
            },
            "required": ["title"]
        }
    },
    {
        "name": "complete_quest",
        "description": "Complete a quest and award EXP & Gold to the hero.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "Task ID to complete"}
            },
            "required": ["task_id"]
        }
    },
    {
        "name": "decompose_epic_goal",
        "description": "Break down a complex goal into 3 bite-sized RPG micro-quests with calculated rewards.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "goal": {"type": "string", "description": "Description of the epic goal or project"}
            },
            "required": ["goal"]
        }
    }
]

def handle_call_tool(name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    data = load_data()

    if name == "get_hero_stats":
        return {
            "content": [
                {
                    "type": "text",
                    "text": json.dumps(data, ensure_ascii=False, indent=2)
                }
            ]
        }

    elif name == "add_quest":
        title = arguments.get("title", "Новый квест")
        priority = arguments.get("priority", "p2")
        exp_reward = arguments.get("exp_reward", 50 if priority == "p1" else 30)
        gold_reward = arguments.get("gold_reward", 30 if priority == "p1" else 15)
        
        task = {
            "id": f"mcp-task-{len(data['tasks']) + 1}",
            "title": title,
            "priority": priority,
            "dueDate": arguments.get("due_date"),
            "dueTime": arguments.get("due_time"),
            "durationMinutes": arguments.get("duration_minutes", 25),
            "tags": arguments.get("tags", ["mcp-quest"]),
            "expReward": exp_reward,
            "goldReward": gold_reward,
            "completed": False,
            "inFocusFlow": priority == "p1"
        }
        data["tasks"].append(task)
        save_data(data)

        return {
            "content": [
                {
                    "type": "text",
                    "text": f"✅ Квест '{title}' успешно добавлен! Награда: +{exp_reward} EXP, +{gold_reward} Золота. В фокусе ShortsFlow: {task['inFocusFlow']}."
                }
            ]
        }

    elif name == "complete_quest":
        task_id = arguments.get("task_id")
        found = False
        for t in data["tasks"]:
            if t.get("id") == task_id or t.get("title") == task_id:
                t["completed"] = True
                exp = t.get("expReward", 30)
                gold = t.get("goldReward", 20)
                data["stats"]["exp"] += exp
                data["stats"]["gold"] += gold
                found = True
                save_data(data)
                return {
                    "content": [
                        {
                            "type": "text",
                            "text": f"🎉 Квест '{t['title']}' выполнен! Герой получил +{exp} EXP, +{gold} Золота!"
                        }
                    ]
                }
        return {"content": [{"type": "text", "text": f"Квест с ID/названием '{task_id}' не найден."}]}

    elif name == "decompose_epic_goal":
        goal = arguments.get("goal", "Задача")
        quests = [
            {
                "title": f"⚔️ [Разведка] {goal}: сбор материалов",
                "priority": "p2",
                "expReward": 35,
                "goldReward": 20,
                "durationMinutes": 20
            },
            {
                "title": f"⚡ [Штурм] {goal}: реализация черновика",
                "priority": "p1",
                "expReward": 80,
                "goldReward": 50,
                "durationMinutes": 45
            },
            {
                "title": f"🏆 [Триумф] {goal}: полировка и финальный запуск",
                "priority": "p3",
                "expReward": 45,
                "goldReward": 30,
                "durationMinutes": 25
            }
        ]
        for q in quests:
            data["tasks"].append({
                "id": f"mcp-task-{len(data['tasks']) + 1}",
                **q,
                "completed": False,
                "tags": ["ai-decomposed"]
            })
        save_data(data)
        return {
            "content": [
                {
                    "type": "text",
                    "text": f"🧙‍♂️ Цель '{goal}' успешно декомпозирована на 3 RPG-квеста и добавлена в QuestFlow:\n" + "\n".join([f"- {q['title']} (+{q['expReward']} EXP, +{q['goldReward']}g)" for q in quests])
                }
            ]
        }

    return {"content": [{"type": "text", "text": f"Unknown tool: {name}"}]}

def main():
    """Simple JSON-RPC MCP loop over stdin/stdout"""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            req_id = req.get("id")
            method = req.get("method")

            if method == "tools/list":
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {"tools": TOOLS}
                }
                sys.stdout.write(json.dumps(res) + "\n")
                sys.stdout.flush()

            elif method == "tools/call":
                params = req.get("params", {})
                name = params.get("name")
                args = params.get("arguments", {})
                result = handle_call_tool(name, args)
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": result
                }
                sys.stdout.write(json.dumps(res) + "\n")
                sys.stdout.flush()

            elif method == "initialize":
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {"tools": {}},
                        "serverInfo": {"name": "questflow-mcp", "version": "1.0.0"}
                    }
                }
                sys.stdout.write(json.dumps(res) + "\n")
                sys.stdout.flush()
        except Exception as e:
            sys.stderr.write(f"Error handling MCP message: {e}\n")

if __name__ == "__main__":
    main()
