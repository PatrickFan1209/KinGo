import datetime
import random
from typing import List, Dict
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 🔑 【配置你的 Supabase 雲端連線資訊】
# ==========================================
SUPABASE_URL = "https://cmuhybljmbkhpxbfnopp.supabase.co"
SUPABASE_KEY = "sb_secret_j4k5u_8v2HcUJz4OzZzATw_xKGWaboV"  # 👈 記得替換成你網頁上複製下來的長金鑰

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

# 📋 你的專屬真實名單（自動去重處理）
RAW_USER_LIST = [
    "A", "王承均", "吳冠霆", "黃琮盛", "林敬陞", "莊智宇", "莊智宇", "李協儒", "褚霖", "蔡昕宸", 
    "謝瑞山", "蔡承儒", "莊智宇", "李聖梧", "李育綸", "邱健銘", "莊智宇", "王菘邦", "李冠均", 
    "賴中得", "王睿群", "廖柏勛", "薛秩棋", "宋崇杰", "王睿群", "張智詠", "吳瑞銓", "陳禹辰", 
    "曾國翰", "涂子琰", "陳威仁"
]
REAL_USER_LIST = list(set(RAW_USER_LIST)) # 自動去掉重複的莊智宇與王睿群

# ==========================================
# 📦 Pydantic 資料結構定義（絕不動到你原本的欄位）
# ==========================================
class HistoryItem(BaseModel):
    weight: float
    skeletalMuscle: float = Field(..., alias="skeletal_muscle")
    fatMass: float = Field(..., alias="fat_mass")
    bf_ratio: int
    date: str

    class Config:
        populate_by_name = True

class UserProfile(BaseModel):
    username: str
    gender: str
    height: float
    witness_count: int = 0
    created_at: str       
    last_login_at: str    
    history: List[HistoryItem] = []

# ==========================================
# 🚀 雲端資料庫初始化防呆與擬真資料建置
# ==========================================
@app.on_event("startup")
async def on_startup():
    """當後端程式啟動時，自動呼叫 Supabase 的 SQL API 建立資料表並載入擬真歷史紀錄"""
    async with httpx.AsyncClient() as client:
        # 1. 檢查資料庫是否已經有這批名單
        check_res = await client.get(f"{SUPABASE_URL}/rest/v1/users?select=username", headers=HEADERS)
        if check_res.status_code == 200 and len(check_res.json()) > 0:
            print("✨ 雲端資料庫已有數據，無需重置，數據完美保存中。")
            return

        # 2. 如果沒有，執行初始化建表與數據寫入
        print("🚀 雲端資料庫尚無名單，正在執行自動建置與注入完美的歷史與紅綠差值軌跡...")
        
        for name in REAL_USER_LIST:
            username = name.strip()
            gender = random.choice(["male", "female"])
            
            if gender == "male":
                height = round(random.uniform(170.0, 183.0), 1)
                init_weight = round(random.uniform(75.0, 85.0), 1)
                init_muscle = round(init_weight * random.uniform(0.35, 0.38), 1)
                init_fat = round(init_weight * random.uniform(0.22, 0.25), 1)
            else:
                height = round(random.uniform(155.0, 168.0), 1)
                init_weight = round(random.uniform(52.0, 65.0), 1)
                init_muscle = round(init_weight * random.uniform(0.28, 0.31), 1)
                init_fat = round(init_weight * random.uniform(0.28, 0.33), 1)

            # 🕒 1. 註冊時間：2026/06/13 ~ 2026/06/19 之間
            reg_time = datetime.datetime(2026, 6, random.randint(13, 19), random.randint(8, 22), random.randint(0, 59))
            created_at_str = reg_time.strftime("%Y-%m-%d %H:%M:%S")
            
            # 🕒 2. 最後上線時間：2026/06/25
            last_login_at_str = datetime.datetime(2026, 6, 25, random.randint(8, 23), random.randint(0, 59)).strftime("%Y-%m-%d %H:%M:%S")

            # 📈 數據差值完美走向：
            # 體重下降 -> 負數 (綠字)、肌肉量增長 -> 正數 (紅字)、脂肪減少 -> 負數 (綠字)
            latest_weight = init_weight - random.uniform(1.2, 3.5)
            latest_muscle = init_muscle + random.uniform(0.8, 1.9)
            latest_fat = init_fat - random.uniform(1.5, 2.8)

            history_list = [
                {
                    "weight": round(init_weight, 1),
                    "skeletal_muscle": round(init_muscle, 1),
                    "fat_mass": round(init_fat, 1),
                    "bf_ratio": int((init_fat / init_weight) * 100),
                    "date": reg_time.strftime("%Y-%m-%d")
                },
                {
                    "weight": round(latest_weight, 1),
                    "skeletal_muscle": round(latest_muscle, 1),
                    "fat_mass": round(latest_fat, 1),
                    "bf_ratio": int((latest_fat / latest_weight) * 100),
                    "date": "2026-06-25"
                }
            ]

            payload = {
                "username": username,
                "gender": gender,
                "height": height,
                "witness_count": random.randint(15, 38),
                "created_at": created_at_str,
                "last_login_at": last_login_at_str,
                "history": history_list
            }
            # 寫入 Supabase
            await client.post(f"{SUPABASE_URL}/rest/v1/users", headers=HEADERS, json=payload)
        print("✅ 完美的造假歷史時間軌跡已全數安全寫入 Supabase 雲端！")

# =======================================================
# 🎯 完美對齊前端註冊：把新帳號的初始數據直接灌入雲端！
# =======================================================
@app.post("/api/v1/users/register")
async def register_user(payload: dict):
    username = payload.get("username")
    gender = payload.get("gender", "male")
    w = float(payload.get("weight", 0))
    m = float(payload.get("skeletalMuscle", 0)) # 👈 對齊前端傳來的欄位
    f = float(payload.get("fatMass", 0))        # 👈 對齊前端傳來的欄位
    bf = int(payload.get("bf_ratio", 20))
    
    if not username:
        raise HTTPException(status_code=400, detail="缺少使用者名稱")
        
    import random
    new_user = {
        "username": username,
        "name": username,  # 註冊暱稱直接作為顯示名字
        "avatar": f"https://api.dicebear.com/7.x/adventurer/svg?seed={username}",
        "init_weight": w,
        "init_fat": f,
        "init_muscle": m,
        "weight": w,
        "fat": f,
        "muscle": m,
        "weight_diff": 0.0,
        "fat_diff": 0.0,
        "muscle_diff": 0.0,
        "last_update": "06/29 00:50",
        "witness_count": random.randint(1, 3)
    }
    
    async with httpx.AsyncClient() as client:
        # 將整筆完美的初始數據寫入 Supabase 雲端
        post_res = await client.post(f"{SUPABASE_URL}/rest/v1/users", headers=HEADERS, json=new_user)
        
        if post_res.status_code not in [200, 201, 204]:
            raise HTTPException(status_code=500, detail=f"雲端註冊寫入失敗: {post_res.text}")
            
        # 回傳給前端，讓前端能夠當場把 userProfile 渲染成對的數字！
        return {
            "status": "success",
            "user_data": {
                "username": username,
                "history": [
                    {
                        "date": payload.get("date", "2026-06-29"),
                        "weight": w,
                        "skeletalMuscle": m,
                        "fatMass": f,
                        "bfRatio": bf
                    }
                    # =======================================================
]
            }
        }

# =======================================================
# 🎯 3. 補上「登入 API」：讓已經存在雲端的人可以直接成功登入
# =======================================================
@app.get("/api/v1/users/login/{username}")
async def login_user(username: str):
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{SUPABASE_URL}/rest/v1/users?username=eq.{username}", headers=HEADERS)
        if res.status_code == 200 and res.json():
            db_user = res.json()[0]
            history = db_user.get("history", [])
            if not history:
                history = [{
                    "weight": float(db_user.get("weight", 70)),
                    "skeletal_muscle": float(db_user.get("muscle", 30)),
                    "fat_mass": float(db_user.get("fat", 15)),
                    "bf_ratio": 20,
                    "date": "2026-06-29"
                }]
            return {
                "status": "success",
                "user_data": {
                    "username": db_user.get("username"),
                    "gender": db_user.get("gender", "male"),
                    "height": float(db_user.get("height", 175)),
                    "history": history
                }
            }
        return {"status": "error", "message": "此帳號未註冊！"}

# =======================================================
# 🎯 4. 補上「每日身體數據更新 API」
# =======================================================
@app.post("/api/v1/users/update-data")
@app.post("/api/v1/users/update_data")
@app.post("/api/v1/users/update")
@app.post("/api/v1/users/update/{username}")
async def update_user_data(payload: dict):
    username = payload.get("username")
    new_weight = float(payload.get("weight", 0))
    new_fat = float(payload.get("fatMass", 0))         
    new_muscle = float(payload.get("skeletalMuscle", 0)) 
    
    if not username:
        raise HTTPException(status_code=400, detail="缺少使用者名稱")
        
    async with httpx.AsyncClient() as client:
        user_res = await client.get(f"{SUPABASE_URL}/rest/v1/users?username=eq.{username}", headers=HEADERS)
        if user_res.status_code != 200 or not user_res.json():
            raise HTTPException(status_code=404, detail="找不到該使用者")
            
        db_user = user_res.json()[0]
        init_w = float(db_user.get("init_weight", new_weight))
        init_f = float(db_user.get("init_fat", new_fat))
        init_m = float(db_user.get("init_muscle", new_muscle))
        
        weight_diff = round(new_weight - init_w, 1)
        fat_diff = round(new_fat - init_f, 1)
        muscle_diff = round(new_muscle - init_m, 1)
        
        update_payload = {
            "weight": new_weight,
            "fat": new_fat,
            "muscle": new_muscle,
            "weight_diff": weight_diff,
            "fat_diff": fat_diff,
            "muscle_diff": muscle_diff,
            "last_update": datetime.datetime.now().strftime("%m/%d %H:%M")
        }
        
        await client.patch(f"{SUPABASE_URL}/rest/v1/users?username=eq.{username}", headers=HEADERS, json=update_payload)
        
        return {
            "status": "success",
            "user_data": {
                "username": username,
                "history": [
                    {
                        "date": datetime.datetime.now().strftime("%Y-%m-%d"),
                        "weight": new_weight,
                        "skeletalMuscle": new_muscle,
                        "fatMass": new_fat,
                        "bfRatio": int((new_fat / max(1, new_weight)) * 100)
                    }
                ]
            }
        }

# =======================================================
# 🎯 5. 補上「同儕體態圈大廳 API」
# =======================================================
@app.get("/api/v1/lobby/feed")
async def get_lobby_feed():
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{SUPABASE_URL}/rest/v1/users?select=*", headers=HEADERS)
        if res.status_code != 200:
            return []
        
        users_list = res.json()
        formatted_data = []
        for u in users_list:
            formatted_data.append({
                "username": u.get("username"),
                "name": u.get("name", u.get("username")),
                "avatar": u.get("avatar", "https://api.dicebear.com/7.x/adventurer/svg?seed=" + u.get("username")),
                "weight": u.get("weight"),
                "skeletalMuscle": u.get("muscle", u.get("init_muscle")),  
                "fatMass": u.get("fat", u.get("init_fat")),            
                "weight_diff": u.get("weight_diff", 0.0),
                "muscle_diff": u.get("muscle_diff", 0.0),
                "fat_diff": u.get("fat_diff", 0.0),
                "last_update": u.get("last_update", u.get("created_at", "剛剛")),
                "witness_count": u.get("witness_count", 0)
            })
        return formatted_data