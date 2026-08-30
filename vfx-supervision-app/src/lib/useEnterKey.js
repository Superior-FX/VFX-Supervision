import { useEffect, useRef } from "react";

// Fires `onEnter` whenever Enter is pressed anywhere in the document while
// the calling component is mounted. More robust than binding keydown to one
// specific input: focus can end up elsewhere entirely (e.g. document.body,
// after a native file-picker dialog closes) where a per-element handler
// would silently never fire. The handler itself decides whether the action
// is currently valid (e.g. checking a "matches DELETE" / "can save" flag).
export function useEnterKey(onEnter) {
  const handlerRef = useRef(onEnter);
  handlerRef.current = onEnter;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter") handlerRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
