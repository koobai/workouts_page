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
    # === 极客魔极布局开始（像素级精控版） ===
    
    p.drawer_type = "plain" if is_circular else "title"
    
    if args.type == "github":
        p.height = 35 + p.years.count() * 32 

    def hack_svg_style(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            import re

            # 🎯 绝杀 1：标题处理 (6px + 居中)
            target_title = args.title if args.title else ""
            if target_title:
                pattern_title = r'<text[^>]*>(\s*' + re.escape(target_title) + r'\s*)</text>'
                # 标题压到 6px，向上提一点到 y=12
                replacement_title = r'<text x="50%" y="12" fill="#dfdfdf" text-anchor="middle" style="font-size: 6px; font-family: JetBrainsMono, -apple-system, sans-serif; font-weight: 700;">\1</text>'
                content = re.sub(pattern_title, replacement_title, content)

            # 🎯 绝杀 2 & 3：年份 (5px) 与 公里数 (4px) 垂直压缩并同行对齐
            def compress_and_align(match):
                full_tag = match.group(0)
                try:
                    # 提取原始 y 坐标
                    old_y = float(re.search(r'y="([\d.]+)"', full_tag).group(1))
                    
                    # 1. 识别行索引 (基于原始 43px 步长)
                    base_y = 30 
                    row_index = int((old_y - base_y) / 43) if old_y > base_y else 0
                    y_in_row = (old_y - base_y) % 43
                    
                    # 2. 压缩行距：新 y 坐标基于 32px 步长
                    new_y = base_y + (row_index * 32) + y_in_row
                    
                    # 3. 针对性修改字号和对齐
                    # 处理年份 (识别内容为 20xx)
                    if re.search(r'>\s*20\d{2}\s*<', full_tag):
                        full_tag = re.sub(r'style="[^"]*"', 'style="font-size: 5px; font-family: JetBrainsMono;"', full_tag)
                        new_tag = re.sub(r'y="[\d.]+"', f'y="{new_y:.1f}"', full_tag)
                        return new_tag
                    
                    # 处理公里数 (识别内容为 xx km)
                    elif ' km' in full_tag:
                        # 重点：公里数原本比年份低 5px，我们把它减掉实现对齐，并设为 4px
                        aligned_y = new_y - 5.0
                        full_tag = re.sub(r'style="[^"]*"', 'style="font-size: 4px; font-family: JetBrainsMono;"', full_tag)
                        new_tag = re.sub(r'y="[\d.]+"', f'y="{aligned_y:.1f}"', full_tag)
                        return new_tag
                    
                    # 处理热力图方块和月份 (y 轴同步平移)
                    else:
                        return re.sub(r'y="[\d.]+"', f'y="{new_y:.1f}"', full_tag)
                except:
                    return full_tag

            # 执行全量坐标压缩
            content = re.sub(r'<(text|rect)[^>]*y="[\d.]+"[^>]*>.*?</\1>|<(text|rect)[^>]*y="[\d.]+"[^/>]*/?>', compress_and_align, content, flags=re.DOTALL)

            # 注入全局 CSS
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
