"""
VFX Element Library Browser
=============================
Launch:
    python browser.py

Requires:
    pip install PySide6
    ingest.py must have been run first to generate:
        S:\\_POST_PRODUCTION\\_VFX_ELEMENTS\\_LIBRARY_DATA\\index.json
"""

import json
import sys
import os
from pathlib import Path
from functools import lru_cache

from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QHBoxLayout, QVBoxLayout,
    QSplitter, QListWidget, QListWidgetItem, QLineEdit, QLabel,
    QTreeWidget, QTreeWidgetItem, QStatusBar, QFrame, QComboBox,
    QPushButton, QMenu, QSizePolicy, QScrollArea, QToolBar,
    QSlider, QAbstractItemView,
)
from PySide6.QtCore import (
    Qt, QSize, QThread, Signal, QObject, QRunnable, QThreadPool,
    QTimer, QUrl, QPoint, QRect, QSettings, QEvent,
)
from PySide6.QtGui import (
    QPixmap, QIcon, QColor, QPalette, QFont, QAction,
    QCursor, QPainter, QBrush, QPen,
)
from PySide6.QtMultimedia import QMediaPlayer, QAudioOutput
from PySide6.QtMultimediaWidgets import QVideoWidget


# ── CONFIG ───────────────────────────────────────────────────────────────────

INDEX_PATH   = Path(r"S:\_POST_PRODUCTION\_VFX_ELEMENTS\_LIBRARY_DATA\index.json")
THUMB_SIZE   = 160      # px — thumbnail card size
HOVER_DELAY  = 400      # ms before video preview starts
PREVIEW_W    = 480      # hover video width
PREVIEW_H    = 270      # hover video height

CATEGORY_ICONS = {
    "FIRE":         "🔥", "SMOKE":       "💨", "EXPLOSIONS":  "💥",
    "SPARKS":       "✨", "DUST":        "🌫", "WATER":       "💧",
    "LIGHTNING":    "⚡", "MUZZLE_FLASH":"🔫", "BLOOD":       "🩸",
    "ATMOSPHERICS": "☁", "LENS_FX":     "🔆", "IMPACTS":     "💢",
    "SHOCKWAVE":    "🌊", "GORE":        "⚠", "SKY":         "🌅",
    "TEXTURES":     "🗂", "MISC":        "📦",
}

DARK_STYLE = """
QMainWindow, QWidget {
    background-color: #1e1e1e;
    color: #d4d4d4;
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 12px;
}
QSplitter::handle { background-color: #333; width: 2px; }

/* Sidebar */
QTreeWidget {
    background-color: #252526;
    border: none;
    outline: none;
}
QTreeWidget::item { padding: 5px 8px; border-radius: 4px; }
QTreeWidget::item:selected { background-color: #094771; color: white; }
QTreeWidget::item:hover:!selected { background-color: #2a2d2e; }
QTreeWidget { show-decoration-selected: 1; }

/* Grid */
QListWidget {
    background-color: #1e1e1e;
    border: none;
    outline: none;
}
QListWidget::item { border-radius: 6px; }
QListWidget::item:selected { background-color: #094771; }
QListWidget::item:hover { background-color: #2a2d2e; }

/* Search */
QLineEdit {
    background-color: #3c3c3c;
    border: 1px solid #555;
    border-radius: 4px;
    padding: 5px 10px;
    color: #d4d4d4;
    font-size: 13px;
}
QLineEdit:focus { border-color: #007acc; }

/* Combo */
QComboBox {
    background-color: #3c3c3c;
    border: 1px solid #555;
    border-radius: 4px;
    padding: 4px 8px;
    color: #d4d4d4;
    min-width: 100px;
}
QComboBox::drop-down { border: none; }
QComboBox QAbstractItemView {
    background-color: #252526;
    selection-background-color: #094771;
    border: 1px solid #555;
}

/* Buttons */
QPushButton {
    background-color: #3c3c3c;
    border: 1px solid #555;
    border-radius: 4px;
    padding: 4px 12px;
    color: #d4d4d4;
}
QPushButton:hover { background-color: #4a4a4a; border-color: #007acc; }
QPushButton:pressed { background-color: #094771; }

/* Status bar */
QStatusBar { background-color: #007acc; color: white; font-size: 11px; }
QStatusBar::item { border: none; }

/* Scrollbars */
QScrollBar:vertical {
    background-color: #1e1e1e; width: 10px; margin: 0;
}
QScrollBar::handle:vertical {
    background-color: #424242; border-radius: 5px; min-height: 20px;
}
QScrollBar::handle:vertical:hover { background-color: #686868; }
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height: 0; }
QScrollBar:horizontal {
    background-color: #1e1e1e; height: 10px; margin: 0;
}
QScrollBar::handle:horizontal {
    background-color: #424242; border-radius: 5px; min-width: 20px;
}
QScrollBar::handle:horizontal:hover { background-color: #686868; }
QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal { width: 0; }

/* Context menu */
QMenu {
    background-color: #252526;
    border: 1px solid #454545;
    padding: 4px;
}
QMenu::item { padding: 6px 24px; border-radius: 3px; }
QMenu::item:selected { background-color: #094771; }
QMenu::separator { height: 1px; background-color: #454545; margin: 3px 8px; }

/* Tooltip */
QToolTip {
    background-color: #252526;
    color: #d4d4d4;
    border: 1px solid #454545;
    padding: 4px 8px;
    border-radius: 3px;
}
"""


# ── DATA ─────────────────────────────────────────────────────────────────────

def load_index() -> list[dict]:
    """Load and return the flat element list from index.json."""
    if not INDEX_PATH.exists():
        return []
    with open(INDEX_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return data.get("elements", [])


# ── THUMBNAIL LOADER (background thread) ─────────────────────────────────────

class ThumbSignals(QObject):
    loaded = Signal(str, QPixmap)   # element_id, pixmap


class ThumbLoader(QRunnable):
    """Loads a single thumbnail JPEG in a worker thread."""
    def __init__(self, element_id: str, thumb_path: str):
        super().__init__()
        self.element_id = element_id
        self.thumb_path = thumb_path
        self.signals = ThumbSignals()

    def run(self):
        px = QPixmap(self.thumb_path)
        if px.isNull():
            px = self._placeholder()
        else:
            px = px.scaled(
                THUMB_SIZE, THUMB_SIZE,
                Qt.KeepAspectRatio,
                Qt.SmoothTransformation,
            )
        self.signals.loaded.emit(self.element_id, px)

    @staticmethod
    def _placeholder() -> QPixmap:
        px = QPixmap(THUMB_SIZE, THUMB_SIZE)
        px.fill(QColor("#2a2d2e"))
        painter = QPainter(px)
        painter.setPen(QPen(QColor("#555"), 1))
        painter.setFont(QFont("Segoe UI", 9))
        painter.drawText(px.rect(), Qt.AlignCenter, "No Preview")
        painter.end()
        return px


# ── VIDEO PREVIEW POPUP ───────────────────────────────────────────────────────

class VideoPreview(QWidget):
    """Floating hover video player."""

    def __init__(self, parent=None):
        super().__init__(parent, Qt.Tool | Qt.FramelessWindowHint |
                         Qt.WindowStaysOnTopHint)
        self.setAttribute(Qt.WA_TranslucentBackground, False)
        self.setAttribute(Qt.WA_ShowWithoutActivating)
        self.setFixedSize(PREVIEW_W, PREVIEW_H + 28)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        self._video = QVideoWidget()
        self._video.setFixedSize(PREVIEW_W, PREVIEW_H)
        layout.addWidget(self._video)

        self._label = QLabel()
        self._label.setAlignment(Qt.AlignCenter)
        self._label.setFixedHeight(28)
        self._label.setStyleSheet(
            "background:#252526; color:#d4d4d4; font-size:11px; padding:0 8px;"
        )
        layout.addWidget(self._label)

        self._player = QMediaPlayer()
        self._audio  = QAudioOutput()
        self._audio.setVolume(0)           # silent — visual preview only
        self._player.setAudioOutput(self._audio)
        self._player.setVideoOutput(self._video)
        self._player.setLoops(QMediaPlayer.Infinite)

        self.setStyleSheet("background:#000; border:1px solid #454545;")

    def play(self, proxy_path: str, name: str, screen_pos: QPoint):
        self._player.stop()
        self._player.setSource(QUrl.fromLocalFile(proxy_path))
        self._label.setText(name)
        self._position_near(screen_pos)
        self.show()
        self._player.play()

    def stop(self):
        self._player.stop()
        self.hide()

    def _position_near(self, cursor: QPoint):
        screen = QApplication.primaryScreen().availableGeometry()
        x = cursor.x() + 20
        y = cursor.y() + 20
        if x + self.width() > screen.right():
            x = cursor.x() - self.width() - 10
        if y + self.height() > screen.bottom():
            y = cursor.y() - self.height() - 10
        self.move(x, y)


# ── THUMBNAIL GRID ────────────────────────────────────────────────────────────

class ThumbnailGrid(QListWidget):
    element_hovered = Signal(dict)     # element data on hover
    hover_cleared   = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setViewMode(QListWidget.IconMode)
        self.setIconSize(QSize(THUMB_SIZE, THUMB_SIZE))
        self.setGridSize(QSize(THUMB_SIZE + 24, THUMB_SIZE + 36))
        self.setResizeMode(QListWidget.Adjust)
        self.setMovement(QListWidget.Static)
        self.setSelectionMode(QAbstractItemView.SingleSelection)
        self.setWordWrap(True)
        self.setUniformItemSizes(True)
        self.setMouseTracking(True)
        self.setSpacing(6)

        self._elements: list[dict] = []
        self._id_to_item: dict[str, QListWidgetItem] = {}
        self._pending_ids: set[str] = set()
        self._hover_timer = QTimer()
        self._hover_timer.setSingleShot(True)
        self._hover_timer.timeout.connect(self._emit_hover)
        self._last_hovered_id: str | None = None
        self._pool = QThreadPool.globalInstance()
        self._pool.setMaxThreadCount(8)

        self.setContextMenuPolicy(Qt.CustomContextMenu)
        self.customContextMenuRequested.connect(self._context_menu)

    # ── Population ──

    def populate(self, elements: list[dict]):
        self.clear()
        self._elements = elements
        self._id_to_item.clear()
        self._pending_ids.clear()

        placeholder = self._make_placeholder()

        for el in elements:
            item = QListWidgetItem()
            item.setText(self._display_name(el["name"]))
            item.setIcon(QIcon(placeholder))
            item.setSizeHint(QSize(THUMB_SIZE + 24, THUMB_SIZE + 36))
            item.setData(Qt.UserRole, el)
            item.setToolTip(self._tooltip(el))
            self.addItem(item)
            self._id_to_item[el["element_id"]] = item

        # Kick off background thumbnail loading
        for el in elements:
            tp = el.get("thumbnail_path", "")
            if tp and Path(tp).exists():
                loader = ThumbLoader(el["element_id"], tp)
                loader.signals.loaded.connect(self._on_thumb_loaded)
                self._pool.start(loader)

    def _on_thumb_loaded(self, element_id: str, pixmap: QPixmap):
        item = self._id_to_item.get(element_id)
        if item:
            item.setIcon(QIcon(pixmap))

    # ── Hover ──

    def mouseMoveEvent(self, event):
        super().mouseMoveEvent(event)
        item = self.itemAt(event.pos())
        if item:
            el = item.data(Qt.UserRole)
            eid = el.get("element_id")
            if eid != self._last_hovered_id:
                self._last_hovered_id = eid
                self._hover_timer.stop()
                self._hover_timer.start(HOVER_DELAY)
        else:
            self._clear_hover()

    def leaveEvent(self, event):
        super().leaveEvent(event)
        self._clear_hover()

    def _clear_hover(self):
        self._hover_timer.stop()
        self._last_hovered_id = None
        self.hover_cleared.emit()

    def _emit_hover(self):
        if self._last_hovered_id:
            item = self._id_to_item.get(self._last_hovered_id)
            if item:
                el = item.data(Qt.UserRole)
                self.element_hovered.emit(el)

    # ── Context menu ──

    def _context_menu(self, pos: QPoint):
        item = self.itemAt(pos)
        if not item:
            return
        el = item.data(Qt.UserRole)
        menu = QMenu(self)

        copy_path = QAction("Copy Source Path", self)
        copy_path.triggered.connect(lambda: self._copy_path(el, "source_path"))
        menu.addAction(copy_path)

        copy_proxy = QAction("Copy Proxy Path", self)
        copy_proxy.triggered.connect(lambda: self._copy_path(el, "proxy_path"))
        menu.addAction(copy_proxy)

        menu.addSeparator()

        open_folder = QAction("Open Source Folder", self)
        open_folder.triggered.connect(lambda: self._open_folder(el))
        menu.addAction(open_folder)

        menu.addSeparator()

        copy_nuke = QAction("Copy Nuke Read Node", self)
        copy_nuke.triggered.connect(lambda: self._copy_nuke_node(el))
        menu.addAction(copy_nuke)

        menu.exec(self.mapToGlobal(pos))

    def _copy_path(self, el: dict, key: str):
        path = el.get(key, "")
        if path:
            QApplication.clipboard().setText(path)

    def _open_folder(self, el: dict):
        path = el.get("source_path", "")
        if path:
            folder = str(Path(path).parent)
            os.startfile(folder)

    def _copy_nuke_node(self, el: dict):
        path = el.get("source_path", "").replace("\\", "/")
        ext  = el.get("extension", "")
        if el.get("source_type") == "image_sequence":
            # Build Nuke-style frame range pattern
            first = el.get("seq_frame_range", [1001])[0]
            last  = el.get("seq_frame_range", [1001, 1001])[1]
            p = Path(path)
            pattern = f"{p.parent}/{p.stem}%04d{p.suffix} {first}-{last}"
            node = (f'Read {{\n'
                    f' file "{pattern}"\n'
                    f' first {first}\n last {last}\n'
                    f' origfirst {first}\n origlast {last}\n}}')
        else:
            node = f'Read {{\n file "{path}"\n}}'
        QApplication.clipboard().setText(node)

    # ── Helpers ──

    @staticmethod
    def _display_name(name: str) -> str:
        n = name.replace("_", " ").strip()
        return n[:28] + "…" if len(n) > 28 else n

    @staticmethod
    def _tooltip(el: dict) -> str:
        res = el.get("resolution", [])
        res_str = f"{res[0]}x{res[1]}" if len(res) == 2 else "?"
        fps  = el.get("fps") or ""
        fps_str = f"{fps}fps  " if fps else ""
        dur  = el.get("duration_sec") or ""
        dur_str = f"{dur:.1f}s  " if dur else ""
        alpha = "Alpha  " if el.get("has_alpha") else ""
        codec = el.get("codec","").upper()
        return (f"{el.get('name','')}\n"
                f"{res_str}  {fps_str}{dur_str}{alpha}\n"
                f"{el.get('category','')} · {el.get('source_type','')}"
                + (f" · {codec}" if codec else ""))

    @staticmethod
    def _make_placeholder() -> QPixmap:
        px = QPixmap(THUMB_SIZE, THUMB_SIZE)
        px.fill(QColor("#2a2d2e"))
        return px


# ── CATEGORY SIDEBAR ──────────────────────────────────────────────────────────

class CategorySidebar(QTreeWidget):
    category_selected = Signal(str)   # "" = All

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setHeaderHidden(True)
        self.setRootIsDecorated(False)
        self.setIndentation(12)
        self.itemClicked.connect(self._on_click)
        self._counts: dict[str, int] = {}

    def populate(self, elements: list[dict]):
        from collections import Counter
        self._counts = Counter(e["category"] for e in elements)
        self.clear()

        # ALL
        all_item = QTreeWidgetItem(["  ALL"])
        all_item.setData(0, Qt.UserRole, "")
        f = all_item.font(0)
        f.setBold(True)
        all_item.setFont(0, f)
        all_item.setText(0, f"  ALL  ({len(elements):,})")
        self.addTopLevelItem(all_item)

        # Separator-ish spacing
        for cat in sorted(self._counts.keys()):
            icon = CATEGORY_ICONS.get(cat, "▸")
            count = self._counts[cat]
            item = QTreeWidgetItem([f"  {icon}  {cat}  ({count:,})"])
            item.setData(0, Qt.UserRole, cat)
            self.addTopLevelItem(item)

        self.setCurrentItem(self.topLevelItem(0))

    def _on_click(self, item: QTreeWidgetItem):
        cat = item.data(0, Qt.UserRole)
        self.category_selected.emit(cat if cat is not None else "")


# ── MAIN WINDOW ───────────────────────────────────────────────────────────────

class MainWindow(QMainWindow):

    def __init__(self):
        super().__init__()
        self.setWindowTitle("VFX Element Library")
        self.resize(1400, 900)
        self._all_elements: list[dict] = []
        self._filtered: list[dict] = []
        self._active_category = ""
        self._search_text = ""
        self._filter_alpha = "Any Alpha"
        self._filter_type  = "Any Type"

        self._build_ui()
        self._load_data()
        self._restore_state()

    # ── UI Construction ──

    def _build_ui(self):
        # Central splitter
        splitter = QSplitter(Qt.Horizontal)
        self.setCentralWidget(splitter)

        # ─ Left sidebar ─
        sidebar_widget = QWidget()
        sidebar_layout = QVBoxLayout(sidebar_widget)
        sidebar_layout.setContentsMargins(8, 8, 4, 8)
        sidebar_layout.setSpacing(6)

        sidebar_header = QLabel("CATEGORIES")
        sidebar_header.setStyleSheet(
            "color:#888; font-size:10px; font-weight:bold; letter-spacing:1px;"
        )
        sidebar_layout.addWidget(sidebar_header)

        self._sidebar = CategorySidebar()
        self._sidebar.category_selected.connect(self._on_category)
        sidebar_layout.addWidget(self._sidebar)

        sidebar_widget.setMinimumWidth(200)
        sidebar_widget.setMaximumWidth(280)
        splitter.addWidget(sidebar_widget)

        # ─ Right panel ─
        right_widget = QWidget()
        right_layout = QVBoxLayout(right_widget)
        right_layout.setContentsMargins(4, 8, 8, 8)
        right_layout.setSpacing(6)

        # Toolbar row
        toolbar = QWidget()
        tb_layout = QHBoxLayout(toolbar)
        tb_layout.setContentsMargins(0, 0, 0, 0)
        tb_layout.setSpacing(8)

        self._search = QLineEdit()
        self._search.setPlaceholderText("Search elements...")
        self._search.setClearButtonEnabled(True)
        self._search.textChanged.connect(self._on_search)
        tb_layout.addWidget(self._search, stretch=1)

        # Alpha filter
        self._alpha_filter = QComboBox()
        self._alpha_filter.addItems(["Any Alpha", "Has Alpha", "No Alpha"])
        self._alpha_filter.currentTextChanged.connect(self._on_filter_change)
        tb_layout.addWidget(self._alpha_filter)

        # Type filter
        self._type_filter = QComboBox()
        self._type_filter.addItems(["Any Type", "video", "image_sequence", "image"])
        self._type_filter.currentTextChanged.connect(self._on_filter_change)
        tb_layout.addWidget(self._type_filter)

        # Thumb size slider
        size_label = QLabel("Size:")
        size_label.setStyleSheet("color:#888;")
        tb_layout.addWidget(size_label)
        self._size_slider = QSlider(Qt.Horizontal)
        self._size_slider.setRange(80, 320)
        self._size_slider.setValue(THUMB_SIZE)
        self._size_slider.setFixedWidth(100)
        self._size_slider.valueChanged.connect(self._on_size_change)
        tb_layout.addWidget(self._size_slider)

        right_layout.addWidget(toolbar)

        # Grid
        self._grid = ThumbnailGrid()
        self._grid.element_hovered.connect(self._on_hover)
        self._grid.hover_cleared.connect(self._on_hover_clear)
        self._grid.itemDoubleClicked.connect(self._on_double_click)
        right_layout.addWidget(self._grid)

        splitter.addWidget(right_widget)
        splitter.setSizes([220, 1180])

        # Video preview popup
        self._preview = VideoPreview(self)
        self._preview.hide()

        # Status bar
        self._status = QStatusBar()
        self.setStatusBar(self._status)
        self._status_label = QLabel()
        self._status.addWidget(self._status_label)

        self.setStyleSheet(DARK_STYLE)

    # ── Data ──

    def _load_data(self):
        self._status_label.setText("Loading index...")
        QApplication.processEvents()
        self._all_elements = load_index()
        if not self._all_elements:
            self._status_label.setText(
                f"No index found at {INDEX_PATH}  —  run ingest.py first."
            )
            return
        self._sidebar.populate(self._all_elements)
        self._apply_filters()

    # ── Filtering ──

    def _apply_filters(self):
        results = self._all_elements

        if self._active_category:
            results = [e for e in results if e.get("category") == self._active_category]

        if self._search_text:
            q = self._search_text.lower()
            results = [e for e in results
                       if q in e.get("name", "").lower()
                       or q in e.get("category", "").lower()
                       or q in e.get("source_folder", "").lower()
                       or any(q in t for t in e.get("tags", []))]

        if self._filter_alpha == "Has Alpha":
            results = [e for e in results if e.get("has_alpha")]
        elif self._filter_alpha == "No Alpha":
            results = [e for e in results if not e.get("has_alpha")]

        if self._filter_type != "Any Type":
            results = [e for e in results if e.get("source_type") == self._filter_type]

        self._filtered = results
        self._grid.populate(results)
        self._update_status()

    def _update_status(self):
        total = len(self._all_elements)
        showing = len(self._filtered)
        cat = self._active_category or "ALL"
        self._status_label.setText(
            f"  {showing:,} of {total:,} elements   |   {cat}"
        )

    # ── Signal handlers ──

    def _on_category(self, cat: str):
        self._active_category = cat
        self._apply_filters()

    def _on_search(self, text: str):
        self._search_text = text
        self._apply_filters()

    def _on_filter_change(self):
        self._filter_alpha = self._alpha_filter.currentText()
        self._filter_type  = self._type_filter.currentText()
        self._apply_filters()

    def _on_size_change(self, value: int):
        # Snap to even numbers for video scaling
        value = value if value % 2 == 0 else value + 1
        self._grid.setIconSize(QSize(value, value))
        self._grid.setGridSize(QSize(value + 24, value + 36))

    def _on_hover(self, el: dict):
        proxy = el.get("proxy_path", "")
        if proxy and Path(proxy).exists():
            self._preview.play(proxy, el.get("name", ""), QCursor.pos())
        else:
            self._preview.stop()

    def _on_hover_clear(self):
        self._preview.stop()

    def _on_double_click(self, item: QListWidgetItem):
        el = item.data(Qt.UserRole)
        path = el.get("source_path", "")
        if path and Path(path).exists():
            os.startfile(str(Path(path).parent))

    # ── Window state ──

    def _restore_state(self):
        settings = QSettings("VFXLib", "Browser")
        geo = settings.value("geometry")
        if geo:
            self.restoreGeometry(geo)

    def closeEvent(self, event):
        self._preview.stop()
        settings = QSettings("VFXLib", "Browser")
        settings.setValue("geometry", self.saveGeometry())
        super().closeEvent(event)


# ── ENTRY POINT ───────────────────────────────────────────────────────────────

def main():
    # High-DPI support
    os.environ.setdefault("QT_ENABLE_HIGHDPI_SCALING", "1")
    app = QApplication(sys.argv)
    app.setApplicationName("VFX Element Library")
    app.setOrganizationName("VFXLib")

    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
