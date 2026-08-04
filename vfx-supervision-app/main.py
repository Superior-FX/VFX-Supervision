"""
VFX Supervision App
=====================
Desktop reference/checklist companion for VFX supervisors — independent of
the Element Library tooling (see ../element-library).

Launch:
    python main.py

Requires:
    pip install -r requirements.txt   (PySide6)
"""

import json
import sys
from pathlib import Path

from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QHBoxLayout, QVBoxLayout,
    QListWidget, QListWidgetItem, QStackedWidget, QSplitter, QTextBrowser,
    QTabWidget, QScrollArea, QGroupBox, QCheckBox, QLabel,
)
from PySide6.QtCore import Qt


APP_ROOT = Path(__file__).resolve().parent
REFERENCES_DIR = APP_ROOT / "references"
CHECKLISTS_DIR = APP_ROOT / "checklists"
TOOLS_DIR = APP_ROOT / "tools"
CHECKLIST_STATE_PATH = CHECKLISTS_DIR / ".state.json"

CHECKLIST_FILES = [
    ("Pre-Production", CHECKLISTS_DIR / "pre_production.json"),
    ("Production", CHECKLISTS_DIR / "production.json"),
    ("Post-Production", CHECKLISTS_DIR / "post_production.json"),
]


def load_checklist_state() -> dict:
    if CHECKLIST_STATE_PATH.exists():
        try:
            return json.loads(CHECKLIST_STATE_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def save_checklist_state(state: dict) -> None:
    CHECKLIST_STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


def title_from_markdown(path: Path) -> str:
    """Use the file's first H1 as its display name, falling back to the filename."""
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("# "):
                return line[2:].strip()
    except OSError:
        pass
    return path.stem.replace("-", " ").replace("_", " ").title()


class ReferencesPage(QWidget):
    def __init__(self):
        super().__init__()
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        splitter = QSplitter(Qt.Horizontal)
        layout.addWidget(splitter)

        self.file_list = QListWidget()
        self.file_list.setMaximumWidth(280)
        splitter.addWidget(self.file_list)

        self.viewer = QTextBrowser()
        self.viewer.setOpenExternalLinks(True)
        splitter.addWidget(self.viewer)
        splitter.setStretchFactor(1, 1)

        self.files = sorted(REFERENCES_DIR.glob("*.md")) if REFERENCES_DIR.exists() else []
        for path in self.files:
            item = QListWidgetItem(title_from_markdown(path))
            item.setData(Qt.UserRole, str(path))
            self.file_list.addItem(item)

        self.file_list.currentItemChanged.connect(self._on_selection_changed)
        if self.file_list.count():
            self.file_list.setCurrentRow(0)
        else:
            self.viewer.setMarkdown("No reference files found in `references/`.")

    def _on_selection_changed(self, current, _previous):
        if current is None:
            return
        path = Path(current.data(Qt.UserRole))
        self.viewer.setMarkdown(path.read_text(encoding="utf-8"))


class ChecklistTab(QWidget):
    def __init__(self, checklist_path: Path, state: dict, on_change):
        super().__init__()
        self.state = state
        self.on_change = on_change

        outer = QVBoxLayout(self)

        if not checklist_path.exists():
            outer.addWidget(QLabel(f"Checklist file not found: {checklist_path.name}"))
            return

        data = json.loads(checklist_path.read_text(encoding="utf-8"))

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        outer.addWidget(scroll)

        content = QWidget()
        content_layout = QVBoxLayout(content)
        scroll.setWidget(content)

        for section in data.get("sections", []):
            box = QGroupBox(section.get("title", "").replace("&", "&&"))
            box_layout = QVBoxLayout(box)
            for item in section.get("items", []):
                item_id = item["id"]
                checkbox = QCheckBox(item["label"].replace("&", "&&"))
                checkbox.setChecked(bool(self.state.get(item_id, False)))
                checkbox.toggled.connect(self._make_handler(item_id))
                box_layout.addWidget(checkbox)
            content_layout.addWidget(box)

        content_layout.addStretch(1)

    def _make_handler(self, item_id):
        def handler(checked):
            self.state[item_id] = checked
            self.on_change(self.state)
        return handler


class ChecklistsPage(QWidget):
    def __init__(self):
        super().__init__()
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self.state = load_checklist_state()

        tabs = QTabWidget()
        layout.addWidget(tabs)

        for label, path in CHECKLIST_FILES:
            tabs.addTab(ChecklistTab(path, self.state, self._on_state_changed), label)

    def _on_state_changed(self, state):
        save_checklist_state(state)


class ToolsPage(QWidget):
    def __init__(self):
        super().__init__()
        layout = QVBoxLayout(self)
        viewer = QTextBrowser()
        readme = TOOLS_DIR / "README.md"
        if readme.exists():
            viewer.setMarkdown(readme.read_text(encoding="utf-8"))
        else:
            viewer.setMarkdown("# Tools\n\nNo tools have been added yet.")
        layout.addWidget(viewer)


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("VFX Supervision")
        self.resize(1200, 800)

        central = QWidget()
        self.setCentralWidget(central)
        layout = QHBoxLayout(central)

        self.nav = QListWidget()
        self.nav.setMaximumWidth(160)
        self.nav.addItems(["Tools", "References", "Checklists"])
        layout.addWidget(self.nav)

        self.stack = QStackedWidget()
        layout.addWidget(self.stack)
        self.stack.addWidget(ToolsPage())
        self.stack.addWidget(ReferencesPage())
        self.stack.addWidget(ChecklistsPage())

        self.nav.currentRowChanged.connect(self.stack.setCurrentIndex)
        self.nav.setCurrentRow(1)  # start on References


def main():
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
