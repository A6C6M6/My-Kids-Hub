(async () => {
    "use strict";
    const $ = id => document.getElementById(id);
    const state = { client:null, user:null, students:[], fees:[], payments:[], filteredPayments:[], filteredFees:[], charts:{} };
    const money = v => `₹ ${Number(v||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    const esc = v => String(v??"").replace(/[&<>\'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\'":"&#39;",'"':"&quot;"}[c]));
    const name = s => `${s?.first_name||""} ${s?.last_name||""}`.trim() || "Unnamed Student";
    const date = d => d ? new Date(`${d}T00:00:00`) : null;
    const fmtDate = d => { const x=date(d); return x ? x.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—"; };
    const show = (m,t="success") => { const e=$("reportMessage"); e.textContent=m||""; e.className=m?`module-message ${t}`:"module-message"; };
    const client = async () => { if(window.supabaseClient?.auth)return window.supabaseClient; throw new Error("Supabase client is not available."); };
    const setUser = u => { const n=u.user_metadata?.full_name||u.user_metadata?.name||u.email||"User"; const i=n.trim().slice(0,2).toUpperCase(); document.querySelectorAll(".user-info strong,.profile-text strong").forEach(e=>e.textContent=n); document.querySelectorAll(".avatar").forEach(e=>e.textContent=i); };
    const load = async () => {
        const [st,fe,pa] = await Promise.all([
            state.client.from("students").select("id,first_name,last_name,admission_number,class_name").order("first_name"),
            state.client.from("student_fees").select("id,student_id,fee_name,amount,discount_amount,final_amount,due_date,academic_year,status").order("due_date",{ascending:true}),
            state.client.from("payments").select("id,student_id,amount,payment_method,payment_date,transaction_reference").order("payment_date",{ascending:true})
        ]);
        if(st.error)throw st.error;if(fe.error)throw fe.error;if(pa.error)throw pa.error;
        state.students=st.data||[];state.fees=fe.data||[];state.payments=pa.data||[];
        const classes=[...new Set(state.students.map(s=>s.class_name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
        $("reportClass").innerHTML='<option value="">All Classes</option>'+classes.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
        render();
    };
    const inRange=(d,from,to)=>{if(!d)return false;return (!from||d>=from)&&(!to||d<=to)};
    const render = () => {
        const from=$("reportFrom").value,to=$("reportTo").value, cls=$("reportClass").value;
        const studentIds=new Set(state.students.filter(s=>!cls||s.class_name===cls).map(s=>s.id));
        state.filteredPayments=state.payments.filter(p=>studentIds.has(p.student_id)&&inRange(p.payment_date,from,to));
        state.filteredFees=state.fees.filter(f=>studentIds.has(f.student_id)&&(!from||!f.due_date||f.due_date>=from)&&(!to||!f.due_date||f.due_date<=to));
        const collected=state.filteredPayments.reduce((a,p)=>a+Number(p.amount||0),0);
        const due=state.filteredFees.filter(f=>!['paid','cancelled'].includes(f.status)).reduce((a,f)=>a+Number(f.final_amount??(Number(f.amount||0)-Number(f.discount_amount||0))),0);
        $("reportCollected").textContent=money(collected);$("reportDue").textContent=money(due);$("reportStudents").textContent=studentIds.size;$("reportPayments").textContent=state.filteredPayments.length;
        renderCharts();renderTable();
    };
    const renderCharts=()=>{
        Object.values(state.charts).forEach(c=>c?.destroy()); state.charts={};
        const byDate={}; state.filteredPayments.forEach(p=>byDate[p.payment_date]=(byDate[p.payment_date]||0)+Number(p.amount||0));
        state.charts.collection=new Chart($("collectionChart"),{type:"line",data:{labels:Object.keys(byDate).sort(),datasets:[{label:"Collected",data:Object.keys(byDate).sort().map(k=>byDate[k]),tension:.35,fill:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{callback:v=>`₹${Number(v).toLocaleString("en-IN")}`}}}}});
        const dueByClass={}; state.filteredFees.filter(f=>!['paid','cancelled'].includes(f.status)).forEach(f=>{const s=state.students.find(x=>x.id===f.student_id);const k=s?.class_name||"Unassigned";dueByClass[k]=(dueByClass[k]||0)+Number(f.final_amount??(Number(f.amount||0)-Number(f.discount_amount||0)));});
        const labels=Object.keys(dueByClass).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
        state.charts.due=new Chart($("classDueChart"),{type:"bar",data:{labels,datasets:[{label:"Due",data:labels.map(k=>dueByClass[k])}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{callback:v=>`₹${Number(v).toLocaleString("en-IN")}`}}}}});
    };
    const renderTable=()=>{
        const type=$("reportType").value, head=$("reportTableHead"), body=$("reportTableBody"), title=$("reportTableTitle");
        if(type==="payments"){
            title.textContent="Payment Report";head.innerHTML="<tr><th>Student</th><th>Amount</th><th>Method</th><th>Date</th><th>Reference</th></tr>";
            body.innerHTML=state.filteredPayments.length?state.filteredPayments.map(p=>{const s=state.students.find(x=>x.id===p.student_id);return `<tr><td>${esc(name(s))}</td><td>${money(p.amount)}</td><td>${esc(p.payment_method)}</td><td>${esc(fmtDate(p.payment_date))}</td><td>${esc(p.transaction_reference||"—")}</td></tr>`}).join(""):"<tr><td colspan='5' class='table-state'>No payments found.</td></tr>";
        } else if(type==="dues"){
            title.textContent="Fee Due Summary";head.innerHTML="<tr><th>Student</th><th>Fee</th><th>Due Date</th><th>Status</th><th>Outstanding</th></tr>";
            const rows=state.filteredFees.filter(f=>!['paid','cancelled'].includes(f.status));body.innerHTML=rows.length?rows.map(f=>{const s=state.students.find(x=>x.id===f.student_id);return `<tr><td>${esc(name(s))}</td><td>${esc(f.fee_name)}</td><td>${esc(fmtDate(f.due_date))}</td><td><span class='badge-pill ${f.status==='overdue'?'danger':'warn'}'>${esc(f.status)}</span></td><td>${money(f.final_amount??(Number(f.amount||0)-Number(f.discount_amount||0)))}</td></tr>`}).join(""):"<tr><td colspan='5' class='table-state'>No outstanding fees found.</td></tr>";
        } else if(type==="class"){
            title.textContent="Class-wise Summary";head.innerHTML="<tr><th>Class</th><th>Students</th><th>Payments</th><th>Collected</th><th>Due</th></tr>";
            const map={};state.students.forEach(s=>{if(!state.filteredFees.some(f=>f.student_id===s.id)&&!state.filteredPayments.some(p=>p.student_id===s.id))return;const k=s.class_name||"Unassigned";map[k]??={students:new Set(),payments:0,collected:0,due:0};map[k].students.add(s.id)});state.filteredPayments.forEach(p=>{const s=state.students.find(x=>x.id===p.student_id);const k=s?.class_name||"Unassigned";map[k]??={students:new Set(),payments:0,collected:0,due:0};map[k].payments++;map[k].collected+=Number(p.amount||0)});state.filteredFees.filter(f=>!['paid','cancelled'].includes(f.status)).forEach(f=>{const s=state.students.find(x=>x.id===f.student_id);const k=s?.class_name||"Unassigned";map[k]??={students:new Set(),payments:0,collected:0,due:0};map[k].due+=Number(f.final_amount??(Number(f.amount||0)-Number(f.discount_amount||0)))});
            const keys=Object.keys(map).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));body.innerHTML=keys.length?keys.map(k=>`<tr><td>${esc(k)}</td><td>${map[k].students.size}</td><td>${map[k].payments}</td><td>${money(map[k].collected)}</td><td>${money(map[k].due)}</td></tr>`).join(""):"<tr><td colspan='5' class='table-state'>No class data found.</td></tr>";
        } else { title.textContent="Overview";head.innerHTML="<tr><th>Student</th><th>Class</th><th>Total Paid</th><th>Total Due</th><th>Status</th></tr>";const map={};state.students.forEach(s=>{map[s.id]={paid:0,due:0,s}});state.filteredPayments.forEach(p=>{if(map[p.student_id])map[p.student_id].paid+=Number(p.amount||0)});state.filteredFees.filter(f=>!['paid','cancelled'].includes(f.status)).forEach(f=>{if(map[f.student_id])map[f.student_id].due+=Number(f.final_amount??(Number(f.amount||0)-Number(f.discount_amount||0)))});const ids=[...new Set([...state.filteredPayments.map(p=>p.student_id),...state.filteredFees.map(f=>f.student_id)])];body.innerHTML=ids.length?ids.map(id=>{const x=map[id];return `<tr><td>${esc(name(x.s))}</td><td>${esc(x.s.class_name||"—")}</td><td>${money(x.paid)}</td><td>${money(x.due)}</td><td><span class='badge-pill ${x.due>0?'warn':''}'>${x.due>0?'Due':'Clear'}</span></td></tr>`}).join(""):"<tr><td colspan='5' class='table-state'>No report data found.</td></tr>";}
    };
    const exportRows=()=>{const type=$("reportType").value; if(type==='payments')return state.filteredPayments.map(p=>{const s=state.students.find(x=>x.id===p.student_id);return {Student:name(s),Class:s?.class_name||"",Amount:Number(p.amount||0),Method:p.payment_method,Date:p.payment_date,Reference:p.transaction_reference||""}});if(type==='dues')return state.filteredFees.filter(f=>!['paid','cancelled'].includes(f.status)).map(f=>{const s=state.students.find(x=>x.id===f.student_id);return {Student:name(s),Class:s?.class_name||"",Fee:f.fee_name,DueDate:f.due_date||"",Status:f.status,Outstanding:Number(f.final_amount??(Number(f.amount||0)-Number(f.discount_amount||0)))}});return state.students.map(s=>({Student:name(s),Class:s.class_name||"",Paid:state.filteredPayments.filter(p=>p.student_id===s.id).reduce((a,p)=>a+Number(p.amount||0),0),Due:state.filteredFees.filter(f=>f.student_id===s.id&&!['paid','cancelled'].includes(f.status)).reduce((a,f)=>a+Number(f.final_amount??(Number(f.amount||0)-Number(f.discount_amount||0))),0)})).filter(r=>r.Paid||r.Due);};
    const exportExcel=()=>{const rows=exportRows();const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Report");XLSX.writeFile(wb,"My-Kids-Hub-Report.xlsx");show("Excel report exported.")};
    const exportPdf=()=>{const rows=exportRows();const {jsPDF}=window.jspdf||{};if(!jsPDF)throw new Error("PDF library is unavailable.");const doc=new jsPDF();doc.setFontSize(16);doc.text("My-Kids-Hub Fee Report",14,18);doc.setFontSize(9);doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`,14,25);const cols=rows.length?Object.keys(rows[0]):["Message"];const body=rows.length?rows.map(r=>cols.map(c=>String(r[c]??""))):[["No data"]];doc.autoTable({head:[cols],body,startY:32,styles:{fontSize:8}});doc.save("My-Kids-Hub-Report.pdf");show("PDF report exported.")};
    try{state.client=await client();const {data,error}=await state.client.auth.getSession();if(error)throw error;if(!data?.session?.user){window.location.replace("index.html");return}state.user=data.session.user;setUser(state.user);document.querySelectorAll(".logout-btn").forEach(b=>b.addEventListener("click",async e=>{e.preventDefault();await state.client.auth.signOut();window.location.replace("index.html")}));$("menuToggle").addEventListener("click",()=>$("sidebar").classList.toggle("open"));await load()}catch(e){console.error(e);show(e.message||"Unable to load reports.","error")}
    ["reportFrom","reportTo","reportClass","reportType"].forEach(id=>$(id).addEventListener("change",render));$("refreshReportBtn").addEventListener("click",async()=>{try{await load();show("Reports refreshed.")}catch(e){show(e.message,"error")}});$("exportExcelBtn").addEventListener("click",()=>{try{exportExcel()}catch(e){show(e.message,"error")}});$("exportPdfBtn").addEventListener("click",()=>{try{exportPdf()}catch(e){show(e.message,"error")}});
})();
