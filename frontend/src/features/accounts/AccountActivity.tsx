import { ArrowUpRight, BriefcaseBusiness, MessageCircle, Send } from 'lucide-react';
import { useState } from 'react';

const examples = {
  weekly: [
    { label: 'Mon', sent: 3, replies: 1, interviews: 0 },
    { label: 'Tue', sent: 5, replies: 2, interviews: 1 },
    { label: 'Wed', sent: 2, replies: 0, interviews: 0 },
    { label: 'Thu', sent: 6, replies: 2, interviews: 1 },
    { label: 'Fri', sent: 4, replies: 1, interviews: 0 },
    { label: 'Sat', sent: 1, replies: 0, interviews: 0 },
    { label: 'Sun', sent: 3, replies: 2, interviews: 1 },
  ],
  monthly: [
    { label: 'Week 1', sent: 12, replies: 4, interviews: 1 },
    { label: 'Week 2', sent: 18, replies: 7, interviews: 2 },
    { label: 'Week 3', sent: 15, replies: 5, interviews: 1 },
    { label: 'Week 4', sent: 24, replies: 8, interviews: 3 },
  ],
};

export function AccountActivity() {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [selected, setSelected] = useState(0);
  const data = examples[period];

  const total = data.reduce(
    (sum, item) => ({
      sent: sum.sent + item.sent,
      replies: sum.replies + item.replies,
      interviews: sum.interviews + item.interviews,
    }),
    { sent: 0, replies: 0, interviews: 0 },
  );

  const maximum = Math.max(...data.map((item) => item.sent));
  const point = data[selected];

  return (
    <section
      className="account-activity"
      aria-label="Example application activity"
    >
      <div className="activity-caption">
        <span>What your journey could look like</span>
        <span className="mock-badge">Preview data</span>
      </div>
      <div className="dashboard-stats">
        {[
          {
            label: 'Applications sent',
            value: total.sent,
            icon: Send,
            caption: 'Every step opens a possibility',
          },
          {
            label: 'Company responses',
            value: total.replies,
            icon: MessageCircle,
            caption: 'Conversations worth starting',
          },
          {
            label: 'Interviews',
            value: total.interviews,
            icon: BriefcaseBusiness,
            caption: 'A chance to tell your story',
          },
        ].map(({ label, value, icon: Icon, caption }) => (
          <div
            className="dashboard-stat"
            key={label}
          >
            <span className="stat-label">
              <Icon size={16} />
              {label}
            </span>
            <strong key={`${period}-${label}`}>
              {value}
              <ArrowUpRight size={18} />
            </strong>
            <span>{caption}</span>
          </div>
        ))}
      </div>
      <div className="activity-grid">
        <div className="dashboard-panel activity-chart-panel">
          <div className="dashboard-panel-heading">
            <div>
              <h2>Your momentum</h2>
              <p>Applications and replies, over time.</p>
            </div>
            <div
              className="activity-period"
              role="group"
              aria-label="Example activity period"
            >
              {(['weekly', 'monthly'] as const).map((key) => (
                <button
                  key={key}
                  aria-pressed={period === key}
                  onClick={() => {
                    setPeriod(key);
                    setSelected(0);
                  }}
                >
                  {key === 'weekly' ? 'Week' : 'Month'}
                </button>
              ))}
            </div>
          </div>
          <div className="activity-legend">
            <span>
              <i />
              Applications
            </span>
            <span>
              <i />
              Responses
            </span>
          </div>
          <div
            className="activity-chart"
            key={period}
            role="group"
            aria-label="Illustrative application and response counts"
          >
            {data.map((item, index) => (
              <button
                className="activity-column"
                key={item.label}
                aria-pressed={selected === index}
                aria-label={`${item.label}: ${item.sent} applications, ${item.replies} responses`}
                onClick={() => setSelected(index)}
              >
                <span className="activity-bars">
                  <span
                    className="activity-bar"
                    style={{ height: `${(item.sent / maximum) * 100}%` }}
                  />
                  <span
                    className="activity-bar activity-bar-replies"
                    style={{ height: `${(item.replies / maximum) * 100}%` }}
                  />
                </span>
                <span className="activity-axis-label">{item.label}</span>
              </button>
            ))}
          </div>
          {point && (
            <p
              className="activity-selection"
              role="status"
            >
              {point.label}: {point.sent} applications · {point.replies} responses{' '}
              <span>Illustrative examples only</span>
            </p>
          )}
        </div>
        <div className="dashboard-panel activity-companies">
          <div className="dashboard-panel-heading">
            <div>
              <h2>Conversations in motion</h2>
              <p>A preview of your company activity.</p>
            </div>
          </div>
          {[
            {
              company: 'Northstar',
              initial: 'N',
              role: 'Product designer',
              status: 'Interview',
              color: 'lilac',
            },
            {
              company: 'Orbit',
              initial: 'O',
              role: 'Frontend engineer',
              status: 'Replied',
              color: 'blue',
            },
            {
              company: 'Studio Nine',
              initial: 'S',
              role: 'Brand strategist',
              status: 'Applied',
              color: 'peach',
            },
          ].map((item) => (
            <div
              className="activity-company"
              key={item.company}
            >
              <span className={`company-initial ${item.color}`}>{item.initial}</span>
              <div>
                <strong>{item.company}</strong>
                <span>{item.role}</span>
              </div>
              <span className={`activity-status ${item.status.toLowerCase()}`}>{item.status}</span>
            </div>
          ))}
          <p className="dashboard-muted-note">
            Fictional companies. Application tracking is a preview.
          </p>
        </div>
      </div>
    </section>
  );
}
