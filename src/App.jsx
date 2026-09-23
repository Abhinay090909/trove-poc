import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Archive,
  Check,
  CheckCircle2,
  ChevronRight,
  Edit3,
  Feather,
  Plus,
  Save,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import koriImage from "../Kori the Raven with a Golden Orb.png";

const STORAGE_KEY = "trove.memories.v1";

const STARTERS = [
  ["Class", "Something from class: "],
  ["Work", "Something from work: "],
  ["Project", "A project experience: "],
  ["Volunteering", "A volunteering experience: "],
  ["Something else", "Something that happened: "],
];

const MEMORY_FIELDS = [
  ["context", "Context"],
  ["responsibility", "Your responsibility"],
  ["challenge", "Challenge"],
  ["action", "What you did"],
  ["result", "Result"],
  ["learning", "What you learned"],
  ["evidence", "Evidence"],
];

const WELCOME = [
  "Hey! What's something that happened recently that's worth remembering?",
  "It can be from class, work, a project, volunteering — or just life.",
];

let localId = 0;
const makeId = (prefix = "item") => `${prefix}-${Date.now()}-${localId++}`;

function readSavedMemories() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

async function callApi(path, conversation) {
  let response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation }),
    });
  } catch {
    throw new Error("Kori couldn't reach the reflection service. Check your connection and try again.");
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    // The friendly fallback below covers a non-JSON upstream response.
  }

  if (!response.ok) {
    throw new Error(data.message || "Kori had trouble thinking about that. Please try again.");
  }
  return data;
}

function KoriAvatar({ size = "medium" }) {
  return (
    <span className={`kori-avatar kori-avatar--${size}`} aria-hidden="true">
      <img src={koriImage} alt="" />
    </span>
  );
}

function Header({ view, hasConversation, savedCount, onBack, onViewSaved }) {
  return (
    <header className="app-header">
      <button
        className="icon-button"
        type="button"
        aria-label={view === "chat" ? "Start over" : "Back to reflection"}
        onClick={onBack}
        disabled={view === "chat" && !hasConversation}
      >
        <ArrowLeft size={20} />
      </button>

      <div className="companion-identity">
        <KoriAvatar size="small" />
        <div>
          <div className="companion-name">Kori</div>
          <div className="companion-subtitle">Reflection companion</div>
        </div>
      </div>

      {savedCount > 0 ? (
        <button className="saved-button" type="button" onClick={onViewSaved}>
          <Archive size={17} />
          <span>{savedCount}</span>
        </button>
      ) : (
        <div className="presence" aria-label="Kori is available">
          <span /> Here with you
        </div>
      )}
    </header>
  );
}

function KoriMessage({ children }) {
  return (
    <div className="message-row message-row--kori">
      <KoriAvatar size="tiny" />
      <div className="message message--kori">{children}</div>
    </div>
  );
}

function StudentMessage({ children }) {
  return (
    <div className="message-row message-row--student">
      <div className="message message--student">{children}</div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="message-row message-row--kori thinking-row" aria-live="polite">
      <KoriAvatar size="tiny" />
      <div className="message message--kori thinking-bubble">
        <span>Kori is thinking</span>
        <span className="thinking-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
    </div>
  );
}

function DiscoveryCard({ onOpen }) {
  return (
    <section className="discovery-card">
      <div className="discovery-icon">
        <Sparkles size={20} />
      </div>
      <div>
        <p className="eyebrow">A memory is taking shape</p>
        <h2>I found a few details worth keeping.</h2>
      </div>
      <button className="primary-button primary-button--gold" type="button" onClick={onOpen}>
        See what we uncovered <ChevronRight size={18} />
      </button>
    </section>
  );
}

function ChatScreen({
  thread,
  input,
  setInput,
  loading,
  error,
  readyMemory,
  onSend,
  onRetry,
  onForceMemory,
  onOpenMemory,
}) {
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const userResponses = thread.filter((message) => message.role === "user").length;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread, loading, error, readyMemory]);

  const chooseStarter = (starter) => {
    setInput(starter);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <>
      <div className="chat-scroll">
        {thread.length === 0 && (
          <div className="welcome-visual" aria-hidden="true">
            <div className="orb-glow" />
            <img src={koriImage} alt="" />
          </div>
        )}

        <div className="message-list" aria-live="polite">
          <KoriMessage>
            <p>{WELCOME[0]}</p>
            <p className="message-secondary">{WELCOME[1]}</p>
          </KoriMessage>

          {thread.length === 0 && (
            <div className="starter-area">
              <p>Start wherever feels easiest</p>
              <div className="starter-chips">
                {STARTERS.map(([label, starter]) => (
                  <button type="button" key={label} onClick={() => chooseStarter(starter)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {thread.map((message) =>
            message.role === "user" ? (
              <StudentMessage key={message.id}>{message.content}</StudentMessage>
            ) : (
              <KoriMessage key={message.id}>{message.content}</KoriMessage>
            ),
          )}

          {loading && <Thinking />}

          {error && !loading && (
            <div className="error-card" role="alert">
              <p>{error}</p>
              <button type="button" onClick={onRetry}>Try again</button>
            </div>
          )}

          {readyMemory && !loading && <DiscoveryCard onOpen={onOpenMemory} />}

          {!readyMemory && userResponses >= 2 && !loading && (
            <button className="create-now" type="button" onClick={onForceMemory}>
              <Sparkles size={16} /> Create memory now
            </button>
          )}
          <div ref={endRef} className="scroll-anchor" />
        </div>
      </div>

      {!readyMemory && (
        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            onSend();
          }}
        >
          <div className="composer-inner">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell Kori what happened..."
              rows={1}
              maxLength={4000}
              disabled={loading}
              aria-label="Tell Kori what happened"
            />
            <button
              className="send-button"
              type="submit"
              aria-label="Send reflection"
              disabled={loading || !input.trim()}
            >
              <Send size={18} />
            </button>
          </div>
          <p>Enter to send · Shift + Enter for a new line</p>
        </form>
      )}
    </>
  );
}

function MemoryField({ field, label, value, editing, onChange }) {
  if (!editing && !value) return null;

  return (
    <div className={`memory-field ${editing ? "memory-field--editing" : ""}`}>
      <div className="field-icon"><Feather size={15} /></div>
      <div className="field-content">
        <label htmlFor={`field-${field}`}>{label}</label>
        {editing ? (
          <textarea
            id={`field-${field}`}
            value={value || ""}
            onChange={(event) => onChange(field, event.target.value)}
            rows={3}
            placeholder={`Add ${label.toLowerCase()}...`}
          />
        ) : (
          <p>{value}</p>
        )}
      </div>
    </div>
  );
}

function SkillCard({ skill, editing, readOnly, onConfirm, onRemove, onEdit, onSaveEdit, onCancelEdit }) {
  const [name, setName] = useState(skill.name);
  const [reason, setReason] = useState(skill.reason);

  useEffect(() => {
    setName(skill.name);
    setReason(skill.reason);
  }, [skill.name, skill.reason, editing]);

  if (editing) {
    return (
      <div className="skill-card skill-card--editing">
        <input value={name} onChange={(event) => setName(event.target.value)} aria-label="Skill name" />
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          aria-label="Why this skill may fit"
          rows={3}
        />
        <div className="skill-actions">
          <button type="button" onClick={() => onSaveEdit(name, reason)} disabled={!name.trim()}>
            <Check size={15} /> Save
          </button>
          <button type="button" className="text-action" onClick={onCancelEdit}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <article className={`skill-card ${skill.status === "confirmed" ? "skill-card--confirmed" : ""}`}>
      <div className="skill-card-top">
        <div className="skill-name">
          {skill.status === "confirmed" && <CheckCircle2 size={17} />}
          {skill.name}
        </div>
        {!readOnly && (
          <button className="mini-icon-button" type="button" onClick={onEdit} aria-label={`Edit ${skill.name}`}>
            <Edit3 size={15} />
          </button>
        )}
      </div>
      <p>“{skill.reason}”</p>
      {readOnly ? (
        <div className="saved-skill-label"><Check size={14} /> Saved with this memory</div>
      ) : (
        <div className="skill-actions">
          <button type="button" onClick={onConfirm}>
            <Check size={15} /> {skill.status === "confirmed" ? "Confirmed" : "Confirm"}
          </button>
          <button type="button" className="text-action text-action--remove" onClick={onRemove}>
            <X size={15} /> Remove
          </button>
        </div>
      )}
    </article>
  );
}

function MemoryScreen({ memory, setMemory, skills, setSkills, onSave, savedPreview, error }) {
  const [editing, setEditing] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [addingSkill, setAddingSkill] = useState(false);
  const [customSkill, setCustomSkill] = useState("");

  const updateField = (field, value) => setMemory((current) => ({ ...current, [field]: value }));

  const addCustomSkill = () => {
    const name = customSkill.trim();
    if (!name) return;
    setSkills((current) => [
      ...current,
      { id: makeId("skill"), name, reason: "Added by you.", status: "confirmed" },
    ]);
    setCustomSkill("");
    setAddingSkill(false);
  };

  const meaningfulFields = MEMORY_FIELDS.filter(([field]) => memory[field]);

  return (
    <div className="memory-scroll">
      <section className="memory-hero">
        <div className="memory-glow">
          <Sparkles size={23} />
        </div>
        <p className="eyebrow">A memory worth keeping</p>
        {editing ? (
          <input
            className="title-input"
            value={memory.title}
            onChange={(event) => updateField("title", event.target.value)}
            aria-label="Memory title"
          />
        ) : (
          <h1>{memory.title}</h1>
        )}
        {!savedPreview && (
          <button className="edit-memory-button" type="button" onClick={() => setEditing((value) => !value)}>
            {editing ? <Check size={15} /> : <Edit3 size={15} />}
            {editing ? "Done editing" : "Edit memory"}
          </button>
        )}
      </section>

      <section className="memory-card">
        {(editing ? MEMORY_FIELDS : meaningfulFields).map(([field, label]) => (
          <MemoryField
            key={field}
            field={field}
            label={label}
            value={memory[field]}
            editing={editing}
            onChange={updateField}
          />
        ))}
      </section>

      <section className="skills-section">
        <div className="section-heading">
          <p className="eyebrow">Possible strengths</p>
          <h2>What this experience may demonstrate</h2>
          <p>Keep only what feels true to you.</p>
        </div>

        <div className="skill-list">
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              editing={editingSkill === skill.id}
              readOnly={savedPreview}
              onConfirm={() =>
                setSkills((current) =>
                  current.map((item) =>
                    item.id === skill.id
                      ? { ...item, status: item.status === "confirmed" ? "suggested" : "confirmed" }
                      : item,
                  ),
                )
              }
              onRemove={() => setSkills((current) => current.filter((item) => item.id !== skill.id))}
              onEdit={() => setEditingSkill(skill.id)}
              onCancelEdit={() => setEditingSkill(null)}
              onSaveEdit={(name, reason) => {
                setSkills((current) =>
                  current.map((item) =>
                    item.id === skill.id
                      ? { ...item, name: name.trim(), reason: reason.trim() || "Edited by you." }
                      : item,
                  ),
                );
                setEditingSkill(null);
              }}
            />
          ))}

          {skills.length === 0 && (
            <div className="empty-skills">No suggested skills kept — and that's completely okay.</div>
          )}
        </div>

        {!savedPreview &&
          (addingSkill ? (
            <div className="add-skill-form">
              <input
                autoFocus
                value={customSkill}
                onChange={(event) => setCustomSkill(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addCustomSkill();
                }}
                placeholder="Name a skill that fits..."
              />
              <button type="button" onClick={addCustomSkill} disabled={!customSkill.trim()}>Add</button>
              <button type="button" className="mini-icon-button" onClick={() => setAddingSkill(false)} aria-label="Cancel">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button className="add-own-button" type="button" onClick={() => setAddingSkill(true)}>
              <Plus size={17} /> Add your own
            </button>
          ))}

        <div className="ownership-note">
          <Feather size={17} />
          <span>You decide what belongs in your story.</span>
        </div>
      </section>

      {!savedPreview && (
        <div className="save-area">
          {error && <div className="error-card memory-error" role="alert"><p>{error}</p></div>}
          <p>Only skills you confirm will be saved.</p>
          <button className="primary-button" type="button" onClick={onSave} disabled={!memory.title.trim()}>
            <Save size={18} /> Save to my Trove
          </button>
        </div>
      )}
    </div>
  );
}

function SuccessScreen({ savedCount, onReset, onViewSaved }) {
  return (
    <div className="success-screen">
      <div className="success-orbit" aria-hidden="true">
        <div className="success-orb"><Check size={28} /></div>
        <span className="spark spark--one">✦</span>
        <span className="spark spark--two">✦</span>
      </div>
      <p className="eyebrow">Safe in your Trove</p>
      <h1>Memory saved to your Trove.</h1>
      <p className="success-copy">A small moment became part of the story you're building.</p>
      <div className="preserved-count">
        <Archive size={18} />
        <strong>{savedCount}</strong> {savedCount === 1 ? "memory" : "memories"} preserved
      </div>
      <button className="primary-button" type="button" onClick={onReset}>
        Reflect on another experience <ChevronRight size={18} />
      </button>
      <button className="secondary-button" type="button" onClick={onViewSaved}>View saved memory</button>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("chat");
  const [thread, setThread] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryConversation, setRetryConversation] = useState(null);
  const [readyMemory, setReadyMemory] = useState(null);
  const [memory, setMemory] = useState(null);
  const [skills, setSkills] = useState([]);
  const [savedMemories, setSavedMemories] = useState(readSavedMemories);
  const [savedPreview, setSavedPreview] = useState(false);

  const userResponseCount = useMemo(
    () => thread.filter((message) => message.role === "user").length,
    [thread],
  );

  const prepareMemory = (source, isSaved = false) => {
    setError("");
    setMemory({ ...source });
    setSkills(
      (source.suggestedSkills || []).map((skill) => ({
        ...skill,
        id: makeId("skill"),
        status: isSaved || skill.confirmed ? "confirmed" : "suggested",
      })),
    );
    setSavedPreview(isSaved);
    setView("memory");
  };

  const requestReflection = async (conversation) => {
    setLoading(true);
    setError("");
    setRetryConversation(null);
    try {
      const result = await callApi("/api/reflect", conversation.map(({ role, content }) => ({ role, content })));
      setThread((current) => [
        ...current,
        { id: makeId("message"), role: "assistant", content: result.message },
      ]);
      if (result.status === "ready" && result.memory) setReadyMemory(result.memory);
    } catch (requestError) {
      setError(requestError.message);
      setRetryConversation(conversation);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = () => {
    const content = input.trim();
    if (!content || loading || readyMemory) return;
    const conversation = [...thread, { id: makeId("message"), role: "user", content }];
    setThread(conversation);
    setInput("");
    requestReflection(conversation);
  };

  const forceMemory = async () => {
    if (loading || userResponseCount < 2) return;
    setLoading(true);
    setError("");
    setRetryConversation(null);
    try {
      const result = await callApi(
        "/api/create-memory",
        thread.map(({ role, content }) => ({ role, content })),
      );
      setThread((current) => [
        ...current,
        { id: makeId("message"), role: "assistant", content: result.message },
      ]);
      setReadyMemory(result.memory);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const resetReflection = () => {
    setView("chat");
    setThread([]);
    setInput("");
    setError("");
    setRetryConversation(null);
    setReadyMemory(null);
    setMemory(null);
    setSkills([]);
    setSavedPreview(false);
  };

  const saveMemory = () => {
    setError("");
    const selectedSkills = skills
      .filter((skill) => skill.status === "confirmed")
      .map(({ name, reason }) => ({ name, reason }));
    const saved = {
      ...memory,
      suggestedSkills: selectedSkills,
      id: makeId("memory"),
      savedAt: new Date().toISOString(),
    };
    const updated = [...savedMemories, saved];

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setSavedMemories(updated);
      setMemory(saved);
      setView("success");
    } catch {
      setError("This browser couldn't save the memory locally. Check its storage settings and try again.");
      setView("memory");
    }
  };

  const viewLatestSaved = () => {
    const latest = savedMemories.at(-1);
    if (latest) prepareMemory(latest, true);
  };

  const handleBack = () => {
    if (view === "chat") resetReflection();
    else if (view === "memory" && savedPreview) resetReflection();
    else if (view === "memory") setView("chat");
    else resetReflection();
  };

  return (
    <div className="prototype-stage">
      <main className={`phone-shell phone-shell--${view}`}>
        <Header
          view={view}
          hasConversation={thread.length > 0}
          savedCount={savedMemories.length}
          onBack={handleBack}
          onViewSaved={viewLatestSaved}
        />

        {view === "chat" && (
          <ChatScreen
            thread={thread}
            input={input}
            setInput={setInput}
            loading={loading}
            error={error}
            readyMemory={readyMemory}
            onSend={sendMessage}
            onRetry={() => retryConversation && requestReflection(retryConversation)}
            onForceMemory={forceMemory}
            onOpenMemory={() => prepareMemory(readyMemory)}
          />
        )}

        {view === "memory" && memory && (
          <MemoryScreen
            memory={memory}
            setMemory={setMemory}
            skills={skills}
            setSkills={setSkills}
            onSave={saveMemory}
            savedPreview={savedPreview}
            error={error}
          />
        )}

        {view === "success" && (
          <SuccessScreen savedCount={savedMemories.length} onReset={resetReflection} onViewSaved={viewLatestSaved} />
        )}
      </main>
    </div>
  );
}
