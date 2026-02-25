import argparse
import logging
import os
import sys

import appdirs
from config import SQL_FILE
from gpxtrackposter import (
    circular_drawer,
    github_drawer,
    grid_drawer,
    poster,
    track_loader,
)
from gpxtrackposter.exceptions import ParameterError, PosterError

# from flopp great repo
__app_name__ = "create_poster"
__app_author__ = "flopp.net"


def main():
    """Handle command line arguments and call other modules as needed."""

    p = poster.Poster()
    drawers = {
        "grid": grid_drawer.GridDrawer(p),
        "circular": circular_drawer.CircularDrawer(p),
        "github": github_drawer.GithubDrawer(p),
    }

    args_parser = argparse.ArgumentParser()
    args_parser.add_argument(
        "--gpx-dir",
        dest="gpx_dir",
        metavar="DIR",
        type=str,
        default=".",
        help="Directory containing GPX files (default: current directory).",
    )
    args_parser.add_argument(
        "--output",
        metavar="FILE",
        type=str,
        default="poster.svg",
        help='Name of generated SVG image file (default: "poster.svg").',
    )
    args_parser.add_argument(
        "--language",
        metavar="LANGUAGE",
        type=str,
        default="",
        help="Language (default: english).",
    )
    args_parser.add_argument(
        "--year",
        metavar="YEAR",
        type=str,
        default="all",
        help='Filter tracks by year; "NUM", "NUM-NUM", "all" (default: all years)',
    )
    args_parser.add_argument(
        "--title", metavar="TITLE", type=str, help="Title to display."
    )
    args_parser.add_argument(
        "--athlete",
        metavar="NAME",
        type=str,
        default="John Doe",
        help='Athlete name to display (default: "John Doe").',
    )
    args_parser.add_argument(
        "--special",
        metavar="FILE",
        action="append",
        default=[],
        help="Mark track file from the GPX directory as special; use multiple times to mark "
        "multiple tracks.",
    )
    types = '", "'.join(drawers.keys())
    args_parser.add_argument(
        "--type",
        metavar="TYPE",
        default="grid",
        choices=drawers.keys(),
        help=f'Type of poster to create (default: "grid", available: "{types}").',
    )
    args_parser.add_argument(
        "--background-color",
        dest="background_color",
        metavar="COLOR",
        type=str,
        default="#222222",
        help='Background color of poster (default: "#222222").',
    )
    args_parser.add_argument(
        "--track-color",
        dest="track_color",
        metavar="COLOR",
        type=str,
        default="#4DD2FF",
        help='Color of tracks (default: "#4DD2FF").',
    )
    args_parser.add_argument(
        "--track-color2",
        dest="track_color2",
        metavar="COLOR",
        type=str,
        help="Secondary color of tracks (default: none).",
    )
    args_parser.add_argument(
        "--text-color",
        dest="text_color",
        metavar="COLOR",
        type=str,
        default="#FFFFFF",
        help='Color of text (default: "#FFFFFF").',
    )
    args_parser.add_argument(
        "--special-color",
        dest="special_color",
        metavar="COLOR",
        default="#FFFF00",
        help='Special track color (default: "#FFFF00").',
    )
    args_parser.add_argument(
        "--special-color2",
        dest="special_color2",
        metavar="COLOR",
        help="Secondary color of special tracks (default: none).",
    )
    args_parser.add_argument(
        "--units",
        dest="units",
        metavar="UNITS",
        type=str,
        choices=["metric", "imperial"],
        default="metric",
        help='Distance units; "metric", "imperial" (default: "metric").',
    )
    args_parser.add_argument(
        "--verbose", dest="verbose", action="store_true", help="Verbose logging."
    )
    args_parser.add_argument("--logfile", dest="logfile", metavar="FILE", type=str)
    args_parser.add_argument(
        "--special-distance",
        dest="special_distance",
        metavar="DISTANCE",
        type=float,
        default=10.0,
        help="Special Distance1 by km and color with the special_color",
    )
    args_parser.add_argument(
        "--special-distance2",
        dest="special_distance2",
        metavar="DISTANCE",
        type=float,
        default=20.0,
        help="Special Distance2 by km and corlor with the special_color2",
    )
    args_parser.add_argument(
        "--min-distance",
        dest="min_distance",
        metavar="DISTANCE",
        type=float,
        default=1.0,
        help="min distance by km for track filter",
    )
    args_parser.add_argument(
        "--use-localtime",
        dest="use_localtime",
        action="store_true",
        help="Use utc time or local time",
    )

    args_parser.add_argument(
        "--from-db",
        dest="from_db",
        action="store_true",
        help="activities db file",
    )

    for _, drawer in drawers.items():
        drawer.create_args(args_parser)

    args = args_parser.parse_args()

    for _, drawer in drawers.items():
        drawer.fetch_args(args)

    log = logging.getLogger("gpxtrackposter")
    log.setLevel(logging.INFO if args.verbose else logging.ERROR)
    if args.logfile:
        handler = logging.FileHandler(args.logfile)
        log.addHandler(handler)

    loader = track_loader.TrackLoader()
    if args.use_localtime:
        loader.use_local_time = True
    if not loader.year_range.parse(args.year):
        raise ParameterError(f"Bad year range: {args.year}.")

    loader.special_file_names = args.special
    loader.min_length = args.min_distance * 1000

    if args.from_db:
        # for svg from db here if you want gpx please do not use --from-db
        # args.type == "grid" means have polyline data or not
        tracks = loader.load_tracks_from_db(
            SQL_FILE, args.type == "grid", args.type == "circular"
        )
    else:
        tracks = loader.load_tracks(args.gpx_dir)
    if not tracks:
        return

    is_circular = args.type == "circular"

    if not is_circular:
        print(
            f"Creating poster of type {args.type} with {len(tracks)} tracks and storing it in file {args.output}..."
        )
    p.set_language(args.language)
    p.athlete = args.athlete
    if args.title:
        p.title = args.title
    else:
        p.title = p.trans("MY TRACKS")

    p.special_distance = {
        "special_distance": args.special_distance,
        "special_distance2": args.special_distance2,
    }

    p.colors = {
        "background": args.background_color,
        "track": args.track_color,
        "track2": args.track_color2 or args.track_color,
        "special": args.special_color,
        "special2": args.special_color2 or args.special_color,
        "text": args.text_color,
    }
    p.units = args.units
    p.set_tracks(tracks)
    # === 极客魔改布局开始（高精度对齐版） ===
    
    # 恢复官方高度逻辑，确保底部 Athlete 等统计信息不重叠
    p.drawer_type = "plain" if is_circular else "title"
    if args.type == "github":
        p.height = 55 + p.years.count() * 43

    # 定义黑客函数：支持浮点坐标，物理对齐 Y 轴
    def hack_svg_style(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            
            import re
            
            # 🎯 绝杀 1：标题处理 (内容锚定)
            target_title = args.title if args.title else ""
            if target_title:
                pattern_title = r'<text[^>]*>(\s*' + re.escape(target_title) + r'\s*)</text>'
                # 重新构建标题：居中
                replacement_title = r'<text x="50%" y="20" fill="#dfdfdf" text-anchor="middle" style="font-size: 6px; font-family: JetBrainsMono, -apple-system, sans-serif; font-weight: 700;">\1</text>'
                content = re.sub(pattern_title, replacement_title, content)
            
            # 🎯 绝杀 2：年份处理 (内容锚定 + 浮点坐标支持)
            # 匹配 2023, 2024, 2025...
            def compress_year(match):
                tag_attrs = match.group(1)
                year_text = match.group(2)
                tag_attrs = re.sub(r'style="[^"]*"', '', tag_attrs) # 剥离旧样式
                return f'<text {tag_attrs} style="font-size: 5px; font-family: JetBrainsMono, -apple-system, sans-serif;">{year_text}</text>'
            
            content = re.sub(r'<text([^>]*)>(\s*20\d{2}\s*)</text>', compress_year, content)

            # 🎯 绝杀 3：公里数对齐 (支持浮点坐标，修复 5px 偏移)
            def align_km(match):
                tag_attrs = match.group(1)
                km_text = match.group(2)
                
                # 修复 Y 坐标：核心在于识别 [\d.]+ 捕获 77.5 这种浮点数
                def fix_y(m):
                    try:
                        old_y = float(m.group(1))
                        new_y = old_y - 5.0 # 向上平移 5px，对齐年份
                        return f'y="{new_y}"'
                    except:
                        return m.group(0)
                
                # 替换 Y 坐标
                tag_attrs = re.sub(r'y="([\d.]+)"', fix_y, tag_attrs)
                # 移除旧 style
                tag_attrs = re.sub(r'style="[^"]*"', '', tag_attrs)
                return f'<text{tag_attrs} style="font-size: 4px; font-family: JetBrainsMono, -apple-system, sans-serif;">{km_text}</text>'
            
            # 匹配类似 "22.7 km" 或 "646.7 km" 的文本块
            content = re.sub(r'<text([^>]*)>\s*([\d,]+(?:\.\d+)?\s*km)\s*</text>', align_km, content)
            
            # 注入全局 CSS 确保字体
            css_inject = """
            <style>
            text { font-family: JetBrainsMono, -apple-system, sans-serif !important; }
            </style>
            </svg>
            """
            content = content.replace('</svg>', css_inject)
            
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
        except Exception:
            pass

    # 开始作画
    if is_circular:
        years = p.years.all()[:]
        for y in years:
            p.years.from_year, p.years.to_year = y, y
            p.set_tracks(tracks)
            out_path = os.path.join("assets", f"year_{str(y)}.svg")
            p.draw(drawers[args.type], out_path)
            hack_svg_style(out_path)
    else:
        p.draw(drawers[args.type], args.output)
        hack_svg_style(args.output)
        
    # === 极客魔改布局结束 ===


if __name__ == "__main__":
    try:
        # generate svg
        main()
    except PosterError as e:
        print(e)
        sys.exit(1)
