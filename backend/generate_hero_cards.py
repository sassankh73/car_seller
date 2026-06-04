#!/usr/bin/env python3
"""Generate hero showcase images with vehicles composited into studio backgrounds.

Each hero image shows a realistic vehicle side-profile composited into one of the
existing studio background images, demonstrating what AutoStudio produces.

Output: frontend/public/hero/{category}.png (5 images, 960x640 each)
"""

import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

# Paths
BACKEND_DIR = Path(__file__).parent
HERO_DIR = BACKEND_DIR.parent / "frontend" / "public" / "hero"
STUDIOS_DIR = BACKEND_DIR / "app" / "static" / "studios"

# Output size for hero cards
CARD_WIDTH = 960
CARD_HEIGHT = 640


def draw_wheel(draw, cx, cy, radius):
    """Draw a detailed wheel with tire, rim, and hub."""
    # Outer tire
    draw.ellipse([cx-radius, cy-radius, cx+radius, cy+radius], fill=(20, 20, 20, 255))
    # Inner tire wall
    r2 = int(radius * 0.82)
    draw.ellipse([cx-r2, cy-r2, cx+r2, cy+r2], fill=(40, 40, 40, 255))
    # Rim outer
    r3 = int(radius * 0.75)
    draw.ellipse([cx-r3, cy-r3, cx+r3, cy+r3], fill=(160, 165, 170, 255))
    # Rim inner
    r4 = int(radius * 0.65)
    draw.ellipse([cx-r4, cy-r4, cx+r4, cy+r4], fill=(140, 145, 150, 255))
    # Spokes (5 spokes)
    r5 = int(radius * 0.55)
    for angle_deg in range(0, 360, 72):
        angle = math.radians(angle_deg)
        x2 = cx + int(r5 * math.cos(angle))
        y2 = cy + int(r5 * math.sin(angle))
        draw.line([(cx, cy), (x2, y2)], fill=(120, 125, 130, 255), width=max(2, radius//8))
    # Hub cap
    r6 = int(radius * 0.22)
    draw.ellipse([cx-r6, cy-r6, cx+r6, cy+r6], fill=(170, 175, 180, 255))
    # Center dot
    r7 = int(radius * 0.08)
    draw.ellipse([cx-r7, cy-r7, cx+r7, cy+r7], fill=(130, 135, 140, 255))
    # Tire highlight arc
    r8 = int(radius * 0.95)
    draw.arc([cx-r8, cy-r8, cx+r8, cy+r8], 200, 340, fill=(50, 50, 50, 255), width=2)


def draw_ground_shadow(img, vehicle_width, ground_y, center_x):
    """Draw a realistic elliptical ground shadow beneath the vehicle."""
    shadow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    
    shadow_w = int(vehicle_width * 0.52)
    shadow_h = int(vehicle_width * 0.045)
    
    for i in range(8):
        alpha = int(22 - i * 2.5)
        w = shadow_w + i * 4
        h = shadow_h + i * 2
        draw.ellipse([
            center_x - w, ground_y - h//2,
            center_x + w, ground_y + h//2
        ], fill=(0, 0, 0, max(1, alpha)))
    
    return Image.alpha_composite(img, shadow)


def _draw_sedan(draw, img, s):
    """Draw a sedan - elegant 4-door car."""
    cx = int(480 * s)
    ground_y = int(430 * s)
    
    body_dark = (35, 40, 48, 255)
    body_mid = (55, 62, 72, 255)
    body_light = (80, 88, 100, 255)
    glass_color = (140, 180, 220, 180)
    
    # Main body
    body_pts = [
        (130*s, ground_y-65*s), (140*s, ground_y-65*s),
        (155*s, ground_y-100*s), (200*s, ground_y-120*s),
        (270*s, ground_y-135*s), (350*s, ground_y-142*s),
        (430*s, ground_y-145*s), (510*s, ground_y-140*s),
        (570*s, ground_y-125*s), (610*s, ground_y-105*s),
        (640*s, ground_y-80*s), (660*s, ground_y-65*s),
        (660*s, ground_y-35*s), (640*s, ground_y-18*s),
        (600*s, ground_y-10*s), (500*s, ground_y-5*s),
        (350*s, ground_y-5*s), (200*s, ground_y-8*s),
        (150*s, ground_y-15*s), (130*s, ground_y-30*s),
    ]
    draw.polygon([(int(x), int(y)) for x, y in body_pts], fill=body_mid)
    draw.line([(int(150*s), ground_y-int(75*s)), (int(640*s), ground_y-int(75*s))], fill=body_light, width=int(2*s))
    
    # Roof
    roof_pts = [
        (270*s, ground_y-135*s), (350*s, ground_y-148*s), (430*s, ground_y-150*s),
        (510*s, ground_y-145*s), (560*s, ground_y-130*s), (570*s, ground_y-125*s),
        (570*s, ground_y-110*s), (510*s, ground_y-110*s), (430*s, ground_y-108*s),
        (350*s, ground_y-110*s), (270*s, ground_y-115*s),
    ]
    draw.polygon([(int(x), int(y)) for x, y in roof_pts], fill=body_dark)
    
    # Windshield
    ws_pts = [(270*s, ground_y-135*s), (230*s, ground_y-118*s), (260*s, ground_y-95*s), (310*s, ground_y-110*s)]
    draw.polygon([(int(x), int(y)) for x, y in ws_pts], fill=glass_color)
    
    # Rear window
    rw_pts = [(510*s, ground_y-140*s), (545*s, ground_y-125*s), (540*s, ground_y-95*s), (505*s, ground_y-110*s)]
    draw.polygon([(int(x), int(y)) for x, y in rw_pts], fill=glass_color)
    
    # Side windows
    draw.polygon([(int(320*s), ground_y-int(112*s)), (int(345*s), ground_y-int(145*s)),
                   (int(430*s), ground_y-int(148*s)), (int(500*s), ground_y-int(142*s)),
                   (int(500*s), ground_y-int(110*s)), (int(430*s), ground_y-int(108*s)),
                   (int(345*s), ground_y-int(110*s))], fill=glass_color)
    
    for px in [345, 430, 500]:
        draw.line([(int(px*s), ground_y-int(142*s)), (int(px*s), ground_y-int(110*s))], fill=body_dark, width=int(3*s))
    
    # Wheels
    wheel_r = int(32 * s)
    draw_wheel(draw, int(237*s), ground_y - int(32*s), wheel_r)
    draw_wheel(draw, int(537*s), ground_y - int(32*s), wheel_r)
    
    # Headlight
    draw.ellipse([int(140*s), ground_y-int(72*s), int(165*s), ground_y-int(62*s)], fill=(255, 220, 100, 230))
    draw.ellipse([int(145*s), ground_y-int(70*s), int(160*s), ground_y-int(64*s)], fill=(255, 255, 220, 200))
    # Taillight
    draw.rounded_rectangle([int(648*s), ground_y-int(72*s), int(658*s), ground_y-int(58*s)], radius=int(2*s), fill=(220, 40, 40, 230))
    # Door handles
    draw.rounded_rectangle([int(370*s), ground_y-int(82*s), int(390*s), ground_y-int(78*s)], radius=int(1*s), fill=(90, 95, 100, 200))
    draw.rounded_rectangle([int(450*s), ground_y-int(80*s), int(470*s), ground_y-int(76*s)], radius=int(1*s), fill=(90, 95, 100, 200))
    
    img = draw_ground_shadow(img, int(530*s), ground_y + int(5*s), cx)
    return img


def _draw_suv(draw, img, s):
    """Draw an SUV - taller ride height, boxier profile."""
    cx = int(480 * s)
    ground_y = int(440 * s)
    
    body_dark = (35, 40, 48, 255)
    body_mid = (55, 62, 72, 255)
    body_light = (80, 88, 100, 255)
    glass_color = (140, 180, 220, 180)
    
    body_pts = [
        (120*s, ground_y-70*s), (140*s, ground_y-70*s),
        (155*s, ground_y-110*s), (195*s, ground_y-130*s),
        (240*s, ground_y-145*s), (300*s, ground_y-155*s),
        (370*s, ground_y-160*s), (440*s, ground_y-160*s),
        (520*s, ground_y-155*s), (570*s, ground_y-140*s),
        (610*s, ground_y-115*s), (640*s, ground_y-85*s),
        (660*s, ground_y-70*s), (660*s, ground_y-30*s),
        (640*s, ground_y-12*s), (600*s, ground_y-5*s),
        (500*s, ground_y-2*s), (350*s, ground_y-2*s),
        (200*s, ground_y-5*s), (150*s, ground_y-12*s), (130*s, ground_y-30*s),
    ]
    draw.polygon([(int(x), int(y)) for x, y in body_pts], fill=body_mid)
    
    roof_pts = [
        (300*s, ground_y-155*s), (370*s, ground_y-168*s), (440*s, ground_y-170*s),
        (520*s, ground_y-165*s), (565*s, ground_y-152*s), (570*s, ground_y-140*s),
        (520*s, ground_y-140*s), (440*s, ground_y-142*s), (370*s, ground_y-142*s), (300*s, ground_y-145*s),
    ]
    draw.polygon([(int(x), int(y)) for x, y in roof_pts], fill=body_dark)
    
    draw.rectangle([int(320*s), ground_y-int(172*s), int(530*s), ground_y-int(168*s)], fill=(120, 125, 130, 200))
    
    ws_pts = [(240*s, ground_y-145*s), (210*s, ground_y-128*s), (240*s, ground_y-100*s), (300*s, ground_y-110*s)]
    draw.polygon([(int(x), int(y)) for x, y in ws_pts], fill=glass_color)
    
    rw_pts = [(520*s, ground_y-155*s), (555*s, ground_y-140*s), (550*s, ground_y-100*s), (520*s, ground_y-110*s)]
    draw.polygon([(int(x), int(y)) for x, y in rw_pts], fill=glass_color)
    
    draw.polygon([(int(310*s), ground_y-int(112*s)), (int(340*s), ground_y-int(155*s)),
                   (int(430*s), ground_y-int(158*s)), (int(510*s), ground_y-int(155*s)),
                   (int(510*s), ground_y-int(110*s)), (int(430*s), ground_y-int(112*s)),
                   (int(340*s), ground_y-int(112*s))], fill=glass_color)
    
    for px in [340, 430, 510]:
        draw.line([(int(px*s), ground_y-int(155*s)), (int(px*s), ground_y-int(112*s))], fill=body_dark, width=int(3*s))
    
    draw.rectangle([int(130*s), ground_y-int(40*s), int(650*s), ground_y-int(28*s)], fill=(45, 50, 58, 255))
    
    wheel_r = int(36 * s)
    draw_wheel(draw, int(237*s), ground_y - int(36*s), wheel_r)
    draw_wheel(draw, int(537*s), ground_y - int(36*s), wheel_r)
    
    draw.polygon([(int(135*s), ground_y-int(82*s)), (int(160*s), ground_y-int(90*s)),
                   (int(165*s), ground_y-int(82*s)), (int(160*s), ground_y-int(72*s)),
                   (int(135*s), ground_y-int(75*s))], fill=(255, 220, 100, 230))
    draw.rounded_rectangle([int(650*s), ground_y-int(80*s), int(660*s), ground_y-int(65*s)], radius=int(2*s), fill=(220, 40, 40, 230))
    
    img = draw_ground_shadow(img, int(550*s), ground_y + int(5*s), cx)
    return img


def _draw_wagon(draw, img, s):
    """Draw a wagon/kombi - extended roof estate car."""
    cx = int(480 * s)
    ground_y = int(435 * s)
    
    body_dark = (35, 40, 48, 255)
    body_mid = (55, 62, 72, 255)
    body_light = (80, 88, 100, 255)
    glass_color = (140, 180, 220, 180)
    
    body_pts = [
        (110*s, ground_y-65*s), (130*s, ground_y-65*s),
        (150*s, ground_y-95*s), (190*s, ground_y-115*s),
        (260*s, ground_y-130*s), (340*s, ground_y-138*s),
        (420*s, ground_y-140*s), (500*s, ground_y-138*s),
        (570*s, ground_y-130*s), (620*s, ground_y-115*s),
        (650*s, ground_y-90*s), (670*s, ground_y-65*s),
        (670*s, ground_y-30*s), (650*s, ground_y-15*s),
        (610*s, ground_y-8*s), (500*s, ground_y-3*s),
        (350*s, ground_y-3*s), (200*s, ground_y-5*s),
        (150*s, ground_y-12*s), (130*s, ground_y-28*s),
    ]
    draw.polygon([(int(x), int(y)) for x, y in body_pts], fill=body_mid)
    
    roof_pts = [
        (260*s, ground_y-130*s), (340*s, ground_y-142*s), (420*s, ground_y-145*s),
        (500*s, ground_y-142*s), (570*s, ground_y-135*s), (620*s, ground_y-118*s),
        (630*s, ground_y-105*s), (570*s, ground_y-105*s), (500*s, ground_y-108*s),
        (420*s, ground_y-110*s), (340*s, ground_y-110*s), (260*s, ground_y-112*s),
    ]
    draw.polygon([(int(x), int(y)) for x, y in roof_pts], fill=body_dark)
    
    draw.rectangle([int(290*s), ground_y-int(146*s), int(600*s), ground_y-int(143*s)], fill=(120, 125, 130, 180))
    
    ws_pts = [(260*s, ground_y-130*s), (230*s, ground_y-115*s), (255*s, ground_y-90*s), (300*s, ground_y-105*s)]
    draw.polygon([(int(x), int(y)) for x, y in ws_pts], fill=glass_color)
    
    rw_pts = [(600*s, ground_y-118*s), (625*s, ground_y-105*s), (625*s, ground_y-85*s), (600*s, ground_y-90*s)]
    draw.polygon([(int(x), int(y)) for x, y in rw_pts], fill=glass_color)
    
    draw.polygon([(int(310*s), ground_y-int(107*s)), (int(340*s), ground_y-int(138*s)),
                   (int(420*s), ground_y-int(140*s)), (int(500*s), ground_y-int(138*s)),
                   (int(560*s), ground_y-int(132*s)), (int(560*s), ground_y-int(105*s)),
                   (int(500*s), ground_y-int(108*s)), (int(420*s), ground_y-int(110*s)),
                   (int(340*s), ground_y-int(110*s))], fill=glass_color)
    
    for px in [340, 420, 500, 560]:
        draw.line([(int(px*s), ground_y-int(138*s)), (int(px*s), ground_y-int(108*s))], fill=body_dark, width=int(3*s))
    
    wheel_r = int(32 * s)
    draw_wheel(draw, int(240*s), ground_y - int(32*s), wheel_r)
    draw_wheel(draw, int(575*s), ground_y - int(32*s), wheel_r)
    
    draw.ellipse([int(125*s), ground_y-int(75*s), int(148*s), ground_y-int(65*s)], fill=(255, 220, 100, 230))
    draw.rounded_rectangle([int(662*s), ground_y-int(72*s), int(670*s), ground_y-int(58*s)], radius=int(2*s), fill=(220, 40, 40, 230))
    
    img = draw_ground_shadow(img, int(560*s), ground_y + int(5*s), cx)
    return img


def _draw_coupe(draw, img, s):
    """Draw a coupe - sleek low-profile 2-door."""
    cx = int(480 * s)
    ground_y = int(425 * s)
    
    body_dark = (35, 40, 48, 255)
    body_mid = (55, 62, 72, 255)
    body_light = (80, 88, 100, 255)
    glass_color = (140, 180, 220, 180)
    
    body_pts = [
        (135*s, ground_y-60*s), (155*s, ground_y-60*s),
        (175*s, ground_y-88*s), (215*s, ground_y-108*s),
        (285*s, ground_y-125*s), (355*s, ground_y-135*s),
        (430*s, ground_y-138*s), (510*s, ground_y-135*s),
        (565*s, ground_y-122*s), (610*s, ground_y-100*s),
        (645*s, ground_y-80*s), (665*s, ground_y-60*s),
        (665*s, ground_y-28*s), (645*s, ground_y-12*s),
        (600*s, ground_y-5*s), (500*s, ground_y-2*s),
        (350*s, ground_y-2*s), (200*s, ground_y-5*s),
        (155*s, ground_y-12*s), (140*s, ground_y-28*s),
    ]
    draw.polygon([(int(x), int(y)) for x, y in body_pts], fill=body_mid)
    draw.line([(int(165*s), ground_y-int(65*s)), (int(640*s), ground_y-int(65*s))], fill=body_light, width=int(2*s))
    
    roof_pts = [
        (285*s, ground_y-125*s), (355*s, ground_y-140*s), (430*s, ground_y-143*s),
        (510*s, ground_y-140*s), (555*s, ground_y-128*s), (560*s, ground_y-118*s),
        (510*s, ground_y-115*s), (430*s, ground_y-118*s), (355*s, ground_y-118*s), (285*s, ground_y-115*s),
    ]
    draw.polygon([(int(x), int(y)) for x, y in roof_pts], fill=body_dark)
    
    ws_pts = [(285*s, ground_y-125*s), (250*s, ground_y-110*s), (280*s, ground_y-85*s), (310*s, ground_y-105*s)]
    draw.polygon([(int(x), int(y)) for x, y in ws_pts], fill=glass_color)
    
    rw_pts = [(510*s, ground_y-135*s), (545*s, ground_y-122*s), (540*s, ground_y-90*s), (510*s, ground_y-105*s)]
    draw.polygon([(int(x), int(y)) for x, y in rw_pts], fill=glass_color)
    
    draw.polygon([(int(315*s), ground_y-int(107*s)), (int(355*s), ground_y-int(138*s)),
                   (int(430*s), ground_y-int(140*s)), (int(505*s), ground_y-int(135*s)),
                   (int(505*s), ground_y-int(105*s)), (int(430*s), ground_y-int(105*s))], fill=glass_color)
    
    draw.line([(int(355*s), ground_y-int(138*s)), (int(355*s), ground_y-int(107*s))], fill=body_dark, width=int(3*s))
    draw.line([(int(430*s), ground_y-int(140*s)), (int(430*s), ground_y-int(105*s))], fill=body_dark, width=int(3*s))
    draw.line([(int(505*s), ground_y-int(135*s)), (int(505*s), ground_y-int(105*s))], fill=body_dark, width=int(3*s))
    
    wheel_r = int(30 * s)
    draw_wheel(draw, int(240*s), ground_y - int(30*s), wheel_r)
    draw_wheel(draw, int(540*s), ground_y - int(30*s), wheel_r)
    
    draw.polygon([(int(145*s), ground_y-int(68*s)), (int(170*s), ground_y-int(75*s)),
                   (int(175*s), ground_y-int(68*s)), (int(170*s), ground_y-int(58*s)),
                   (int(145*s), ground_y-int(60*s))], fill=(255, 220, 100, 230))
    draw.rounded_rectangle([int(657*s), ground_y-int(68*s), int(667*s), ground_y-int(55*s)], radius=int(2*s), fill=(220, 40, 40, 230))
    
    img = draw_ground_shadow(img, int(530*s), ground_y + int(5*s), cx)
    return img


def _draw_ev(draw, img, s):
    """Draw a modern EV/pickup truck."""
    cx = int(480 * s)
    ground_y = int(445 * s)
    
    body_dark = (35, 40, 48, 255)
    body_mid = (55, 62, 72, 255)
    glass_color = (140, 180, 220, 180)
    
    # Full lower body
    lower_pts = [
        (110*s, ground_y-72*s), (130*s, ground_y-72*s),
        (155*s, ground_y-108*s), (190*s, ground_y-130*s),
        (240*s, ground_y-148*s), (300*s, ground_y-155*s),
        (370*s, ground_y-160*s), (430*s, ground_y-158*s),
        (440*s, ground_y-145*s), (445*s, ground_y-148*s),
        (460*s, ground_y-148*s), (580*s, ground_y-148*s),
        (620*s, ground_y-148*s), (660*s, ground_y-138*s),
        (680*s, ground_y-118*s), (690*s, ground_y-95*s),
        (695*s, ground_y-72*s), (695*s, ground_y-28*s),
        (680*s, ground_y-12*s), (600*s, ground_y-5*s),
        (500*s, ground_y-2*s), (350*s, ground_y-2*s),
        (200*s, ground_y-5*s), (140*s, ground_y-12*s),
        (120*s, ground_y-28*s), (110*s, ground_y-42*s),
    ]
    draw.polygon([(int(x), int(y)) for x, y in lower_pts], fill=body_mid)
    
    # Cabin roof
    roof_pts = [
        (240*s, ground_y-148*s), (300*s, ground_y-162*s), (370*s, ground_y-168*s),
        (430*s, ground_y-165*s), (440*s, ground_y-155*s), (440*s, ground_y-148*s),
        (370*s, ground_y-150*s), (300*s, ground_y-150*s),
    ]
    draw.polygon([(int(x), int(y)) for x, y in roof_pts], fill=body_dark)
    
    # Bed area darker
    bed_pts = [
        (445*s, ground_y-148*s), (580*s, ground_y-148*s), (620*s, ground_y-148*s),
        (660*s, ground_y-138*s), (680*s, ground_y-118*s), (690*s, ground_y-95*s),
        (695*s, ground_y-72*s), (440*s, ground_y-72*s), (440*s, ground_y-145*s),
    ]
    draw.polygon([(int(x), int(y)) for x, y in bed_pts], fill=(42, 48, 56, 255))
    
    # Bed rail
    draw.rectangle([int(445*s), ground_y-int(148*s), int(660*s), ground_y-int(144*s)], fill=(120, 125, 130, 180))
    
    # Windshield
    ws_pts = [(240*s, ground_y-148*s), (210*s, ground_y-132*s), (240*s, ground_y-105*s), (295*s, ground_y-115*s)]
    draw.polygon([(int(x), int(y)) for x, y in ws_pts], fill=glass_color)
    
    # Side windows
    draw.polygon([(int(295*s), ground_y-int(115*s)), (int(330*s), ground_y-int(158*s)),
                   (int(375*s), ground_y-int(162*s)), (int(420*s), ground_y-int(158*s)),
                   (int(420*s), ground_y-int(110*s)), (int(375*s), ground_y-int(112*s)),
                   (int(330*s), ground_y-int(112*s))], fill=glass_color)
    
    for px in [330, 375, 420]:
        draw.line([(int(px*s), ground_y-int(158*s)), (int(px*s), ground_y-int(112*s))], fill=body_dark, width=int(3*s))
    
    # Lower cladding
    draw.rectangle([int(115*s), ground_y-int(42*s), int(690*s), ground_y-int(32*s)], fill=(45, 50, 58, 255))
    
    # Wheels (larger for truck)
    wheel_r = int(38 * s)
    draw_wheel(draw, int(225*s), ground_y - int(38*s), wheel_r)
    draw_wheel(draw, int(585*s), ground_y - int(38*s), wheel_r)
    
    # LED headlight
    draw.rounded_rectangle([int(125*s), ground_y-int(78*s), int(155*s), ground_y-int(73*s)], radius=int(2*s), fill=(100, 180, 255, 230))
    draw.rounded_rectangle([int(128*s), ground_y-int(77*s), int(152*s), ground_y-int(74*s)], radius=int(1*s), fill=(200, 230, 255, 200))
    # Taillight
    draw.rounded_rectangle([int(680*s), ground_y-int(78*s), int(693*s), ground_y-int(65*s)], radius=int(2*s), fill=(220, 40, 40, 230))
    # EV indicator
    draw.ellipse([int(400*s), ground_y-int(88*s), int(408*s), ground_y-int(80*s)], fill=(100, 180, 255, 120))
    
    img = draw_ground_shadow(img, int(580*s), ground_y + int(5*s), cx)
    return img


def generate_vehicle_layer(name: str, width: int, height: int) -> Image.Image:
    """Generate a vehicle side-profile as an RGBA image."""
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    s = width / 960.0
    
    if name == "sedan":
        img = _draw_sedan(draw, img, s)
    elif name == "suv":
        img = _draw_suv(draw, img, s)
    elif name == "wagon":
        img = _draw_wagon(draw, img, s)
    elif name == "coupe":
        img = _draw_coupe(draw, img, s)
    elif name == "ev":
        img = _draw_ev(draw, img, s)
    else:
        raise ValueError(f"Unknown vehicle: {name}")
    
    return img


# Hero card definitions
HERO_CARDS = [
    {"vehicle": "sedan", "studio_key": "white_corner_light_epoxy", "label": "Sedan", "studio_name": "White Epoxy Studio"},
    {"vehicle": "suv", "studio_key": "commercial_showroom_tile", "label": "SUV", "studio_name": "Commercial Showroom"},
    {"vehicle": "wagon", "studio_key": "dark_gray_corner_concrete", "label": "Wagon", "studio_name": "Concrete Studio"},
    {"vehicle": "coupe", "studio_key": "black_corner_dark_epoxy", "label": "Coupe", "studio_name": "Dark Automotive Studio"},
    {"vehicle": "ev", "studio_key": "light_gray_corner_medium_epoxy", "label": "EV", "studio_name": "Premium Light Studio"},
]


def main():
    """Generate all hero card images using existing studio backgrounds."""
    HERO_DIR.mkdir(parents=True, exist_ok=True)
    
    print("Generating hero card images...")
    print(f"Studio dir: {STUDIOS_DIR}")
    print(f"Output dir: {HERO_DIR}")
    
    for card in HERO_CARDS:
        print(f"\nGenerating: {card['label']} in {card['studio_name']}...")
        
        # Load existing studio background
        studio_path = STUDIOS_DIR / f"{card['studio_key']}.png"
        if not studio_path.exists():
            print(f"  ERROR: Studio not found: {studio_path}")
            continue
        
        print(f"  Loading studio: {studio_path}")
        studio_img = Image.open(str(studio_path)).convert('RGBA')
        
        # Resize to card dimensions (maintaining aspect ratio, then crop center)
        studio_ratio = studio_img.width / studio_img.height
        target_ratio = CARD_WIDTH / CARD_HEIGHT
        
        if studio_ratio > target_ratio:
            # Studio is wider - match height, crop width
            new_height = CARD_HEIGHT
            new_width = int(CARD_HEIGHT * studio_ratio)
        else:
            # Studio is taller - match width, crop height
            new_width = CARD_WIDTH
            new_height = int(CARD_WIDTH / studio_ratio)
        
        studio_img = studio_img.resize((new_width, new_height), Image.LANCZOS)
        
        # Center crop to exact card dimensions
        left = (new_width - CARD_WIDTH) // 2
        top = (new_height - CARD_HEIGHT) // 2
        studio_img = studio_img.crop((left, top, left + CARD_WIDTH, top + CARD_HEIGHT))
        
        # Generate vehicle layer
        print(f"  Generating vehicle: {card['vehicle']}...")
        vehicle_layer = generate_vehicle_layer(card["vehicle"], CARD_WIDTH, CARD_HEIGHT)
        
        # Composite vehicle onto studio
        result = Image.alpha_composite(studio_img, vehicle_layer)
        
        # Add subtle vignette
        vignette = Image.new('RGBA', result.size, (0, 0, 0, 0))
        vignette_draw = ImageDraw.Draw(vignette)
        for i in range(30):
            alpha = int(18 * (1 - i / 30))
            vignette_draw.rectangle([i, i, result.width - i, result.height - i], outline=(0, 0, 0, alpha))
        result = Image.alpha_composite(result, vignette)
        
        # Convert to RGB
        bg = Image.new('RGB', result.size, (255, 255, 255))
        bg.paste(result, mask=result.split()[3])
        
        # Save PNG
        output_path = HERO_DIR / f"{card['vehicle']}.png"
        bg.save(str(output_path), "PNG", optimize=True)
        print(f"  Saved: {output_path} ({bg.size[0]}x{bg.size[1]})")
    
    print(f"\nAll {len(HERO_CARDS)} hero cards generated in {HERO_DIR}")


if __name__ == "__main__":
    main()