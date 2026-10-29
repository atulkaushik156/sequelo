import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

export default function Wizard({ onContinue, chatId }) {
  const [schemas, setSchemas] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch the inferred schema from LangGraph when the Wizard loads
  useEffect(() => {
    const fetchSchema = async () => {
      try {
        const res = await api.get(`/api/chats/${chatId}/schema`);
        setSchemas(res.data.table_schemas || []);
        setRelationships(res.data.relationships || []);
      } catch (err) {
        toast.error("Failed to load schema analysis. Using default template.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchSchema();
  }, [chatId]);

  const updateTable = (index, field, value) => {
    const updated = [...schemas];
    updated[index][field] = value;
    setSchemas(updated);
  };

  const updateRelationship = (index, field, value) => {
    const updated = [...relationships];
    updated[index][field] = value;
    setRelationships(updated);
  };
  
  const addRelationship = () => {
    setRelationships([...relationships, { source_table: '', source_column: '', target_table: '', target_column: '' }]);
  };

  const updateMetric = (index, field, value) => {
    const updated = [...metrics];
    updated[index][field] = value;
    setMetrics(updated);
  };

  const addMetric = () => {
    setMetrics([...metrics, { name: '', formula: '' }]);
  };

  const handleFinalize = async () => {
    setIsSubmitting(true);
    try {
      await api.post(`/api/chats/${chatId}/finalize-schema`, {
        table_schemas: schemas,
        relationships,
        custom_metrics: metrics
      });
      toast.success("Business logic vectorized!");
      onContinue(); // Unlocks step 3 (ChatInterface)
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to finalize schema.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <Loader2 className="animate-spin text-zinc-900" size={40} />
        <p className="text-zinc-500 font-medium">AI is analyzing your datasets...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-zinc-50/50">
      <div className="max-w-4xl mx-auto p-8 space-y-10 text-zinc-900">
        
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Data Schema & Business Logic</h1>
          <p className="text-zinc-500">Verify the AI's understanding of your data before chatting.</p>
        </div>

        {/* SECTION 1: Tables */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b border-zinc-200 pb-2">1. Verify Your Tables</h2>
          <div className="grid gap-4">
            {schemas.map((table, idx) => (
              <div key={idx} className="p-5 bg-white border border-zinc-200 rounded-xl shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg">{table.table_alias}</h3>
                  <select 
                    className={`text-sm font-semibold px-3 py-1 rounded-full border outline-none ${table.table_type === 'Fact' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200'}`}
                    value={table.table_type}
                    onChange={(e) => updateTable(idx, 'table_type', e.target.value)}
                  >
                    <option value="Fact">Fact Table</option>
                    <option value="Dimension">Dimension Table</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-600">Business Purpose</label>
                  <input 
                    type="text" 
                    className="w-full border border-zinc-300 rounded-lg p-2.5 focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                    value={table.business_purpose}
                    onChange={(e) => updateTable(idx, 'business_purpose', e.target.value)}
                  />
                </div>
              </div>
            ))}
            {schemas.length === 0 && <p className="text-sm text-zinc-500">No tables detected. The AI may still be processing.</p>}
          </div>
        </section>

        {/* SECTION 2: Relationships */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
            <h2 className="text-lg font-semibold">2. Define Relationships</h2>
            <button onClick={addRelationship} className="text-sm bg-zinc-100 text-zinc-900 font-medium px-3 py-1.5 rounded-lg hover:bg-zinc-200 transition-colors">
              + Add Relationship
            </button>
          </div>
          <div className="space-y-3">
            {relationships.map((rel, idx) => (
              <div key={idx} className="p-4 bg-white border border-zinc-200 rounded-xl flex flex-wrap items-center gap-3 text-sm shadow-sm">
                <span className="font-medium text-zinc-600">When looking at</span>
                <select className="border border-zinc-300 rounded-md p-1.5 outline-none" value={rel.source_table} onChange={(e) => updateRelationship(idx, 'source_table', e.target.value)}>
                  <option value="">Select File</option>
                  {schemas.map(s => <option key={s.table_alias} value={s.table_alias}>{s.table_alias}</option>)}
                </select>
                <span className="font-medium text-zinc-600">, match the</span>
                <input type="text" placeholder="e.g. client_id" className="border border-zinc-300 rounded-md p-1.5 w-32 outline-none" value={rel.source_column} onChange={(e) => updateRelationship(idx, 'source_column', e.target.value)} />
                <span className="font-medium text-zinc-600">to the</span>
                <select className="border border-zinc-300 rounded-md p-1.5 outline-none" value={rel.target_table} onChange={(e) => updateRelationship(idx, 'target_table', e.target.value)}>
                  <option value="">Select File</option>
                  {schemas.map(s => <option key={s.table_alias} value={s.table_alias}>{s.table_alias}</option>)}
                </select>
                <span className="font-medium text-zinc-600">file using its</span>
                <input type="text" placeholder="e.g. id" className="border border-zinc-300 rounded-md p-1.5 w-32 outline-none" value={rel.target_column} onChange={(e) => updateRelationship(idx, 'target_column', e.target.value)} />
                <span className="font-medium text-zinc-600">column.</span>
              </div>
            ))}
            {relationships.length === 0 && <p className="text-sm text-zinc-500 italic">No relationships detected.</p>}
          </div>
        </section>

        {/* SECTION 3: Metrics */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
            <h2 className="text-lg font-semibold">3. Custom Metrics</h2>
            <button onClick={addMetric} className="text-sm bg-zinc-100 text-zinc-900 font-medium px-3 py-1.5 rounded-lg hover:bg-zinc-200 transition-colors">
              + Add Metric
            </button>
          </div>
          <div className="space-y-3">
            {metrics.map((metric, idx) => (
              <div key={idx} className="p-4 bg-white border border-zinc-200 rounded-xl flex flex-wrap items-center gap-3 text-sm shadow-sm">
                <span className="font-medium text-zinc-600">Define</span>
                <input type="text" placeholder="Metric Name" className="border border-zinc-300 rounded-md p-1.5 font-semibold outline-none" value={metric.name} onChange={(e) => updateMetric(idx, 'name', e.target.value)} />
                <span className="font-medium text-zinc-600">as</span>
                <input type="text" placeholder="Formula (e.g. revenue - cost)" className="border border-zinc-300 rounded-md p-1.5 flex-1 font-mono outline-none" value={metric.formula} onChange={(e) => updateMetric(idx, 'formula', e.target.value)} />
              </div>
            ))}
          </div>
        </section>

        {/* SUBMIT */}
        <div className="pt-6 pb-12 flex justify-end">
          <button 
            onClick={handleFinalize}
            disabled={isSubmitting}
            className="flex items-center bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-3 px-8 rounded-xl shadow-sm disabled:opacity-50 transition-colors"
          >
            {isSubmitting && <Loader2 size={18} className="animate-spin mr-2" />}
            {isSubmitting ? 'Saving Configuration...' : 'Finalize & Continue'}
          </button>
        </div>

      </div>
    </div>
  );
}