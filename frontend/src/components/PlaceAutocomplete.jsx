// src/components/PlaceAutocomplete.jsx
import React, { useEffect, useRef, useState } from "react";
import debounce from "lodash.debounce";
import { searchPlaces } from "../lib/geocode";

export default function PlaceAutocomplete({
  placeholder = "Ville, pays…",
  onSelect,
  types = "place,city,country",
  initialValue = "",
  onInputChange,             // <- nouveau : remonte le texte tapé au parent
  autoSelectFirstOnEnter = true,
}) {
  const [q, setQ] = useState(initialValue);
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  // si initialValue change (depuis le parent), on sync l'input
  useEffect(() => { setQ(initialValue || ""); }, [initialValue]);

  const fetchDebounced = useRef(
    debounce(async (value) => {
      if (!value || value.length < 2) { setList([]); return; }
      try {
        const res = await searchPlaces(value, { types, limit: 6 });
        setList(res);
        setOpen(true);
      } catch {
        setList([]);
      }
    }, 250)
  ).current;

  useEffect(() => { fetchDebounced(q); }, [q, fetchDebounced]);

  useEffect(() => {
    const onClick = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  const handleChange = (e) => {
    const value = e.target.value;
    setQ(value);
    onInputChange?.(value); // <- on remonte la valeur au parent
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && autoSelectFirstOnEnter && list.length > 0) {
      e.preventDefault();
      const first = list[0];
      setQ(first.name);
      setOpen(false);
      onSelect?.(first);
      onInputChange?.(first.name);
    }
  };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <input
        value={q}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && list.length > 0 && (
        <ul style={{
          position: "absolute", zIndex: 20, left: 0, right: 0, top: "100%",
          background: "#16181d", border: "1px solid #2a2f3a", listStyle: "none",
          margin: 0, padding: "6px 0", maxHeight: 220, overflowY: "auto"
        }}>
          {list.map(item => (
            <li key={item.id}>
              <button
                type="button"
                style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", color: "#e9e9e9", background: "transparent", border: "none", cursor: "pointer" }}
                onClick={() => {
                  setQ(item.name);
                  setOpen(false);
                  onSelect?.(item);
                  onInputChange?.(item.name);
                }}
              >
                {item.name}
                <span style={{ opacity: .6, fontSize: 12, marginLeft: 8 }}>({item.type})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
