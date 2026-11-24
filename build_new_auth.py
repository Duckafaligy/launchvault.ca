"""The sign-in flow: four pages from ONE template (src/new/auth.part.html), full-bleed (chrome=False), picked up by build_new.py.

    /sign-in/  /sign-up/        the form (Clerk through assets/new/auth.js)
    /welcome/                       after sign-in: age question if needed, then "You're in." for new accounts, then the app
    /welcome/callback/              where Google / GitHub / Apple / Discord send people back
"""
import os

STORIES = ["postiz.svg", "gojiberry.png", "rezi.png", "aeoengine.png", "windmillgrowth.png", "upscaleb2b.png", "stencilai.png", "boothie.png", "mindset.png", "dmchamp.png"]
PAGES = [  # path, mode, first step, title, description
    ("sign-in/", "signin", "form", "Sign in · LaunchVault", "Sign in to your LaunchVault account."),
    ("sign-up/", "signup", "form", "Sign up · LaunchVault", "Make a free LaunchVault account. Only needs an email."),
    ("welcome/", "welcome", "wait", "Welcome · LaunchVault", "One quick question, then your dashboard."),
    ("welcome/callback/", "callback", "wait", "Signing you in · LaunchVault", "Finishing sign-in."),
]


def register(B):
    src = open(os.path.join(B.SRC, "auth.part.html"), encoding="utf-8").read()
    tiles = "".join(f'<span class="au-tile"><img src="/assets/logos/{f}" alt="" width="16" height="16"></span>' for f in STORIES)
    for path, mode, step, title, desc in PAGES:
        body = src.replace("{{mode}}", mode).replace("{{step}}", step).replace("{{tiles}}", tiles)
        B.add_page(path=path, body=body, title=title, description=desc, chrome=False, bg="off", body_class="auth-page",
                   css=["/assets/new/auth.css"], js=["/assets/new/auth.js"])
