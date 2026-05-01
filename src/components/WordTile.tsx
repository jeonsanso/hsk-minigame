interface WordTileProps {
  text: string;
  index: number;
  disabled?: boolean;
  variant?: 'choice' | 'answer' | 'correct' | 'wrong';
  onClick: () => void;
}

export function WordTile({ text, index, disabled, variant = 'choice', onClick }: WordTileProps) {
  return (
    <button
      className={`word-tile word-tile--${variant}`}
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      {variant === 'choice' && (
        <span className="word-tile__badge">{index + 1}</span>
      )}
      <span className="word-tile__text">{text}</span>
    </button>
  );
}
