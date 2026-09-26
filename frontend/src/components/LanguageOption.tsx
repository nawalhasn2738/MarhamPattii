type LanguageOptionProps = {
  tag: string;
  title: string;
  hint?: string;
  urdu?: boolean;
  selected: boolean;
  onSelect: () => void;
};

export function LanguageOption({ tag, title, hint, urdu = false, selected, onSelect }: LanguageOptionProps) {
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={selected ? "lang on" : "lang"}>
      <span className={urdu ? "lang-tag urdu" : "lang-tag"}>{tag}</span>
      <span>
        <span className={urdu ? "urdu" : undefined} style={urdu ? { fontSize: 18 } : undefined}>
          {title}
        </span>
        {hint ? <small>{hint}</small> : null}
      </span>
    </button>
  );
}
