import styles from './optionsStyles'

function ListEditor({ title, items, fields, onAdd, onRemove, onChange }) {
  return (
    <section style={styles.section}>
      <h2 style={styles.h2}>{title}</h2>
      {items.length === 0 ? <p style={styles.hint}>Nenhuma ainda.</p> : null}
      {items.map((item, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <div style={styles.itemCard} key={index}>
          {fields.map((field) =>
            field.multiline ? (
              <textarea
                key={field.key}
                style={styles.textarea}
                placeholder={field.placeholder}
                value={item[field.key] ?? ''}
                onChange={(e) => onChange(index, { [field.key]: e.target.value })}
              />
            ) : (
              <input
                key={field.key}
                style={styles.input}
                placeholder={field.placeholder}
                value={item[field.key] ?? ''}
                onChange={(e) => onChange(index, { [field.key]: e.target.value })}
              />
            ),
          )}
          <button type="button" style={styles.buttonSecondary} onClick={() => onRemove(index)}>
            Remover
          </button>
        </div>
      ))}
      <button type="button" style={styles.buttonSecondary} onClick={onAdd}>
        + Adicionar
      </button>
    </section>
  )
}

export default ListEditor
