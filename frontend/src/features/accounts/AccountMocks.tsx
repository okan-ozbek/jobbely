import { Bell, Check, FileText, Mail, Sparkles, Upload, X } from 'lucide-react';
import { useState } from 'react';

export function ResumeLibrary() {
  const [added, setAdded] = useState(false);
  const [notice, setNotice] = useState('');

  return (
    <section className="dashboard-panel resume-library">
      <div className="dashboard-panel-heading">
        <div>
          <h2>A home for your story</h2>
          <p>Your resume, ready for your next opportunity.</p>
        </div>
        <span className="mock-badge">Preview</span>
      </div>
      {added ? (
        <div className="resume-demo-file">
          <span className="dashboard-feature-icon">
            <FileText size={23} />
          </span>
          <div>
            <strong>Sample resume.pdf</strong>
            <span>Example document · 2 pages</span>
          </div>
          <span className="resume-ready">
            <Check size={14} />
            Demo ready
          </span>
          <button
            className="dashboard-icon-button"
            aria-label="Remove sample resume"
            onClick={() => {
              setAdded(false);
              setNotice('Sample resume removed from the preview.');
            }}
          >
            <X size={17} />
          </button>
        </div>
      ) : (
        <div className="resume-upload-preview">
          <span className="dashboard-feature-icon">
            <Upload size={23} />
          </span>
          <h3>Make your next move feel closer.</h3>
          <p>Preview a resume library with a sample document.</p>
          <button
            className="dashboard-button"
            onClick={() => {
              setAdded(true);
              setNotice('Sample resume added. No file was selected or uploaded.');
            }}
          >
            <Upload size={15} />
            Preview an upload
          </button>
        </div>
      )}
      <p className="dashboard-muted-note">
        Demo only. No document is uploaded or saved. Use the home page to review your own resume
        locally.
      </p>
      {notice && (
        <p
          className="dashboard-feedback"
          role="status"
        >
          {notice}
        </p>
      )}
    </section>
  );
}

export function AccountPreferences() {
  const [preferences, setPreferences] = useState({ alerts: false, digest: false, updates: false });
  const [changed, setChanged] = useState(false);

  return (
    <section className="dashboard-panel preferences-panel">
      <div className="dashboard-panel-heading">
        <div>
          <h2>A little less noise.</h2>
          <p>Choose how you would like to hear from Jobbely.</p>
        </div>
        <span className="mock-badge">Preview</span>
      </div>
      {(
        [
          {
            key: 'alerts',
            icon: Bell,
            title: 'Opportunity notifications',
            description: 'A heads-up when a new role could be worth a look.',
          },
          {
            key: 'digest',
            icon: Mail,
            title: 'Weekly email digest',
            description: 'A thoughtful round-up of new opportunities, in your inbox.',
          },
          {
            key: 'updates',
            icon: Sparkles,
            title: 'Product updates',
            description: 'Occasional news about what is new at Jobbely.',
          },
        ] as const
      ).map(({ key, icon: Icon, title, description }) => (
        <div
          className="preference-row"
          key={key}
        >
          <span className="preference-icon">
            <Icon size={20} />
          </span>
          <div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          <button
            className="preference-switch"
            role="switch"
            aria-label={title}
            aria-checked={preferences[key]}
            onClick={() => {
              setPreferences((value) => ({ ...value, [key]: !value[key] }));
              setChanged(true);
            }}
          >
            <span />
          </button>
        </div>
      ))}
      <p className="dashboard-muted-note">
        Demo preferences stay in this preview only. They are not saved and do not send notifications
        or emails.
      </p>
      {changed && (
        <p
          className="dashboard-feedback"
          role="status"
        >
          Preview updated. No notifications or emails will be sent.
        </p>
      )}
    </section>
  );
}
