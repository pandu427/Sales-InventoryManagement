import React, { useEffect, useMemo, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(n||0));
const blankProduct = {sku:'',name:'',description:'',price:'',stock:0};
const blankCustomer = {name:'',email:'',phone:'',address:''};

export default function App(){
  const [token,setToken] = useState(localStorage.getItem('token')||'');
  const [user,setUser] = useState(JSON.parse(localStorage.getItem('user')||'null'));
  const [page,setPage] = useState('Dashboard');
  const [dashboard,setDashboard] = useState(null);
  const [products,setProducts] = useState([]);
  const [customers,setCustomers] = useState([]);
  const [orders,setOrders] = useState([]);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [busy,setBusy] = useState(false);
  const [productForm,setProductForm] = useState(blankProduct);
  const [customerForm,setCustomerForm] = useState(blankCustomer);
  const [editProduct,setEditProduct] = useState(null);
  const [editCustomer,setEditCustomer] = useState(null);
  const [orderCustomer,setOrderCustomer] = useState('');
  const [orderNote,setOrderNote] = useState('');
  const [lines,setLines] = useState([{product_id:'',quantity:1}]);
  const [decisionNotes,setDecisionNotes] = useState({});

  async function api(path, options={}){
    const headers = {'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) , ...(options.headers||{})};
    const response = await fetch(API+path,{...options,headers});
    const data = await response.json().catch(()=>({detail:'Unexpected server response'}));
    if(!response.ok) throw new Error(data.detail || 'Request failed');
    return data;
  }
  async function loadAll(){
    try{
      const [d,p,c,o] = await Promise.all([api('/dashboard'),api('/products'),api('/customers'),api('/orders')]);
      setDashboard(d); setProducts(p); setCustomers(c); setOrders(o); setError('');
    }catch(e){setError(e.message);}
  }
  useEffect(()=>{if(token) loadAll();},[token]);
  async function login(e){
    e.preventDefault(); setBusy(true); setError('');
    const fd = new FormData(e.currentTarget);
    try{
      const response = await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:fd.get('email'),password:fd.get('password')})});
      const data=await response.json(); if(!response.ok) throw new Error(data.detail||'Login failed');
      localStorage.setItem('token',data.access_token); localStorage.setItem('user',JSON.stringify(data.user));
      setToken(data.access_token);setUser(data.user);setNotice('Welcome back!');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  function logout(){localStorage.removeItem('token');localStorage.removeItem('user');setToken('');setUser(null);setDashboard(null);}
  async function submitProduct(e){
    e.preventDefault();setError('');setNotice('');
    try{
      const body={...productForm,price:Number(productForm.price),stock:Number(productForm.stock)};
      await api(editProduct?`/products/${editProduct}`:'/products',{method:editProduct?'PUT':'POST',body:JSON.stringify(body)});
      setProductForm(blankProduct);setEditProduct(null);setNotice('Product saved.');await loadAll();
    }catch(e){setError(e.message);}
  }
  async function removeProduct(id){if(!confirm('Delete this product?'))return;try{await api(`/products/${id}`,{method:'DELETE'});setNotice('Product deleted.');loadAll();}catch(e){setError(e.message);}}
  async function submitCustomer(e){
    e.preventDefault();setError('');setNotice('');
    try{
      await api(editCustomer?`/customers/${editCustomer}`:'/customers',{method:editCustomer?'PUT':'POST',body:JSON.stringify(customerForm)});
      setCustomerForm(blankCustomer);setEditCustomer(null);setNotice('Customer saved.');await loadAll();
    }catch(e){setError(e.message);}
  }
  async function removeCustomer(id){if(!confirm('Delete this customer?'))return;try{await api(`/customers/${id}`,{method:'DELETE'});setNotice('Customer deleted.');loadAll();}catch(e){setError(e.message);}}
  async function submitOrder(e){
    e.preventDefault();setError('');setNotice('');
    try{
      const items=lines.filter(x=>x.product_id).map(x=>({product_id:Number(x.product_id),quantity:Number(x.quantity)}));
      if(!orderCustomer||!items.length)throw new Error('Select a customer and at least one product.');
      const result=await api('/orders',{method:'POST',body:JSON.stringify({customer_id:Number(orderCustomer),items,note:orderNote})});
      setNotice(`Order #${result.id} created: ${result.status.replaceAll('_',' ')}.`);setLines([{product_id:'',quantity:1}]);setOrderNote('');await loadAll();
    }catch(e){setError(e.message);}
  }
  async function decide(id,action){
    try{await api(`/orders/${id}/${action}`,{method:'POST',body:JSON.stringify({note:decisionNotes[id]||''})});setNotice(`Order #${id} ${action==='approve'?'approved':'rejected'}.`);await loadAll();}
    catch(e){setError(e.message);}
  }
  const canManage=['admin','manager'].includes(user?.role);
  const customerName=id=>customers.find(c=>c.id===id)?.name||`Customer #${id}`;
  const productName=id=>products.find(p=>p.id===id)?.name||`Product #${id}`;
  if(!token)return <div className="login-wrap"><form className="login-card" onSubmit={login}><div className="brand-mark">SI</div><p className="eyebrow">OPERATIONS PORTAL</p><h1>Welcome back</h1><p className="muted">Sign in to manage sales and inventory.</p>{error&&<div className="alert error">{error}</div>}<label>Email<input name="email" type="email" defaultValue="admin@example.com" required/></label><label>Password<input name="password" type="password" defaultValue="Admin123!" required/></label><button className="primary full" disabled={busy}>{busy?'Signing in…':'Sign in'}</button><p className="muted small">Demo: admin@example.com / Admin123!</p></form></div>;

  const nav=['Dashboard','Products','Customers','Sales Orders','Approvals'];
  return <div className="app-shell">
    <aside className="sidebar"><div className="logo"><span className="brand-mark">SI</span><span>Stockwise<small>SALES & INVENTORY</small></span></div><p className="nav-label">WORKSPACE</p>{nav.map(n=><button key={n} className={`nav-item ${page===n?'active':''}`} onClick={()=>{setPage(n);setError('');}}><span className="nav-icon">{({'Dashboard':'▦','Products':'◫','Customers':'♙','Sales Orders':'▤','Approvals':'✓'})[n]}</span>{n}{n==='Approvals'&&dashboard?.pending_approvals>0&&<span className="count">{dashboard.pending_approvals}</span>}</button>)}<div className="sidebar-bottom"><div className="avatar">{user?.name?.slice(0,1)||'U'}</div><div className="user-meta"><b>{user?.name}</b><small>{user?.role}</small></div><button className="icon-btn" onClick={logout} title="Sign out">↗</button></div></aside>
    <main className="main"><header className="topbar"><div><span className="crumb">Workspace / </span><b>{page}</b></div><div className="top-right"><span className="live-dot"/> System online <span className="avatar small-avatar">{user?.name?.slice(0,1)}</span></div></header>
    <section className="content"><div className="page-heading"><div><p className="eyebrow">OVERVIEW</p><h1>{page}</h1><p className="muted">{page==='Dashboard'?'Here’s what’s happening with your business today.':`Manage your ${page.toLowerCase()} in one place.`}</p></div><button className="secondary" onClick={loadAll}>↻ Refresh data</button></div>
    {error&&<div className="alert error">{String(error)}</div>}{notice&&<div className="alert success">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
    {page==='Dashboard'&&<><div className="stat-grid">{[['Total sales',money(dashboard?.confirmed_sales),'↗','Across confirmed orders'],['Sales orders',dashboard?.orders??'—','▤','All order records'],['Products',dashboard?.products??'—','◫','Active catalog'],['Pending approvals',dashboard?.pending_approvals??'—','◷','Awaiting manager']].map(([t,v,i,s])=><div className="stat-card" key={t}><div className="stat-top"><span>{t}</span><span className="stat-icon">{i}</span></div><strong>{v}</strong><small>{s}</small></div>)}</div><div className="lower-grid"><div className="panel"><div className="panel-heading"><div><h3>Recent sales orders</h3><p className="muted">Latest order activity</p></div><button className="text-btn" onClick={()=>setPage('Sales Orders')}>View all →</button></div><OrderTable orders={dashboard?.recent_orders||[]} customerName={customerName}/></div><div className="panel inventory-panel"><div className="panel-heading"><div><h3>Inventory health</h3><p className="muted">Current stock overview</p></div><span className="stat-icon">◫</span></div><div className="inventory-number"><strong>{dashboard?.inventory_units??0}</strong><span>total units in stock</span></div><div className="health-row"><span>Low stock items</span><b className={(dashboard?.low_stock||0)>0?'warning-text':''}>{dashboard?.low_stock??0}</b></div><div className="health-row"><span>Customers</span><b>{dashboard?.customers??0}</b></div><button className="secondary full" onClick={()=>setPage('Products')}>Review inventory</button></div></div></>}
    {page==='Products'&&<><div className="panel form-panel"><h3>{editProduct?'Edit product':'Add product'}</h3><form className="form-grid" onSubmit={submitProduct}><label>SKU<input required value={productForm.sku} onChange={e=>setProductForm({...productForm,sku:e.target.value})} placeholder="SKU-001"/></label><label>Product name<input required value={productForm.name} onChange={e=>setProductForm({...productForm,name:e.target.value})} placeholder="Product name"/></label><label>Unit price (₹)<input required min="0.01" step="0.01" type="number" value={productForm.price} onChange={e=>setProductForm({...productForm,price:e.target.value})}/></label><label>Stock quantity<input required min="0" type="number" value={productForm.stock} onChange={e=>setProductForm({...productForm,stock:e.target.value})}/></label><label className="span-2">Description<input value={productForm.description} onChange={e=>setProductForm({...productForm,description:e.target.value})} placeholder="Optional description"/></label><div className="form-actions"><button className="primary">{editProduct?'Save changes':'Add product'}</button>{editProduct&&<button type="button" className="secondary" onClick={()=>{setEditProduct(null);setProductForm(blankProduct)}}>Cancel</button>}</div></form></div><div className="panel"><PanelTitle title="Product catalog" subtitle={`${products.length} products`} /><div className="table-wrap"><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>PRICE</th><th>STOCK</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td><b>{p.name}</b><small className="cell-sub">{p.description}</small></td><td><code>{p.sku}</code></td><td>{money(p.price)}</td><td>{p.stock}</td><td><span className={`pill ${p.stock<=5?'pill-warn':'pill-green'}`}>{p.stock<=5?'Low stock':'In stock'}</span></td><td><button className="text-btn" onClick={()=>{setEditProduct(p.id);setProductForm({...p,price:String(p.price)});window.scrollTo({top:0,behavior:'smooth'})}}>Edit</button>{canManage&&<button className="text-btn danger-text" onClick={()=>removeProduct(p.id)}>Delete</button>}</td></tr>)}</tbody></table>{!products.length&&<Empty text="No products yet. Add your first product above."/>}</div></div></>}
    {page==='Customers'&&<><div className="panel form-panel"><h3>{editCustomer?'Edit customer':'Add customer'}</h3><form className="form-grid" onSubmit={submitCustomer}><label>Full name<input required value={customerForm.name} onChange={e=>setCustomerForm({...customerForm,name:e.target.value})} placeholder="Customer name"/></label><label>Email<input type="email" value={customerForm.email} onChange={e=>setCustomerForm({...customerForm,email:e.target.value})} placeholder="customer@example.com"/></label><label>Phone<input value={customerForm.phone} onChange={e=>setCustomerForm({...customerForm,phone:e.target.value})} placeholder="Phone number"/></label><label>Address<input value={customerForm.address} onChange={e=>setCustomerForm({...customerForm,address:e.target.value})} placeholder="Address"/></label><div className="form-actions"><button className="primary">{editCustomer?'Save changes':'Add customer'}</button>{editCustomer&&<button type="button" className="secondary" onClick={()=>{setEditCustomer(null);setCustomerForm(blankCustomer)}}>Cancel</button>}</div></form></div><div className="panel"><PanelTitle title="Customer directory" subtitle={`${customers.length} customers`} /><div className="table-wrap"><table><thead><tr><th>CUSTOMER</th><th>EMAIL</th><th>PHONE</th><th>ADDRESS</th><th>ACTIONS</th></tr></thead><tbody>{customers.map(c=><tr key={c.id}><td><b>{c.name}</b></td><td>{c.email||'—'}</td><td>{c.phone||'—'}</td><td>{c.address||'—'}</td><td><button className="text-btn" onClick={()=>{setEditCustomer(c.id);setCustomerForm(c);window.scrollTo({top:0,behavior:'smooth'})}}>Edit</button>{canManage&&<button className="text-btn danger-text" onClick={()=>removeCustomer(c.id)}>Delete</button>}</td></tr>)}</tbody></table>{!customers.length&&<Empty text="No customers yet. Add a customer above."/>}</div></div></>}
    {page==='Sales Orders'&&<><div className="panel form-panel"><h3>Create sales order</h3><form onSubmit={submitOrder}><div className="form-grid"><label>Customer<select required value={orderCustomer} onChange={e=>setOrderCustomer(e.target.value)}><option value="">Select customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Order note<input value={orderNote} onChange={e=>setOrderNote(e.target.value)} placeholder="Optional note"/></label></div><div className="line-items"><div className="line-title"><b>Order items</b><button type="button" className="text-btn" onClick={()=>setLines([...lines,{product_id:'',quantity:1}])}>+ Add item</button></div>{lines.map((line,i)=><div className="order-line" key={i}><select value={line.product_id} required onChange={e=>setLines(lines.map((l,j)=>j===i?{...l,product_id:e.target.value}:l))}><option value="">Select product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} · {money(p.price)} · {p.stock} available</option>)}</select><input aria-label="Quantity" type="number" min="1" required value={line.quantity} onChange={e=>setLines(lines.map((l,j)=>j===i?{...l,quantity:e.target.value}:l))}/><button type="button" className="remove-line" disabled={lines.length===1} onClick={()=>setLines(lines.filter((_,j)=>j!==i))}>×</button></div>)}</div><div className="order-total"><span>Estimated total</span><strong>{money(lines.reduce((sum,l)=>sum+(products.find(p=>p.id===Number(l.product_id))?.price||0)*Number(l.quantity||0),0))}</strong></div><button className="primary" disabled={!customers.length||!products.length}>Create order</button><p className="muted small">Orders above the configured approval threshold are sent to a manager. Inventory is deducted only when an order is confirmed.</p></form></div><div className="panel"><PanelTitle title="All sales orders" subtitle={`${orders.length} orders`} /><OrderTable orders={orders} customerName={customerName} detailed productName={productName} /></div></>}
    {page==='Approvals'&&<div className="panel"><PanelTitle title="Manager approval queue" subtitle="Review orders that exceed the approval threshold" /><div className="approval-list">{orders.filter(o=>o.status==='pending_approval').map(o=><div className="approval-card" key={o.id}><div className="approval-top"><div><span className="order-id">ORDER #{o.id}</span><h3>{customerName(o.customer_id)}</h3><p className="muted small">{new Date(o.created_at).toLocaleString()}</p></div><div className="approval-amount">{money(o.total)}<span className="pill pill-warn">Needs review</span></div></div><div className="order-items-summary">{o.items.map(i=><span key={i.id}>{productName(i.product_id)} × {i.quantity}</span>)}</div>{o.note&&<p className="muted">Note: {o.note}</p>}{canManage?<><textarea value={decisionNotes[o.id]||''} onChange={e=>setDecisionNotes({...decisionNotes,[o.id]:e.target.value})} placeholder="Decision note (optional)"/><div className="approval-actions"><button className="primary" onClick={()=>decide(o.id,'approve')}>✓ Approve order</button><button className="secondary reject" onClick={()=>decide(o.id,'reject')}>Reject order</button></div></>:<p className="muted small">Manager approval is pending. You will be notified by email when a decision is made.</p>}</div>)}{!orders.some(o=>o.status==='pending_approval')&&<Empty text="You're all caught up. No orders need approval."/>}{!canManage&&orders.some(o=>o.status==='pending_approval')&&<p className="muted small">Only managers and administrators can approve or reject orders.</p>}</div></div>}
    </section></main></div>;
}
function PanelTitle({title,subtitle}){return <div className="panel-heading"><div><h3>{title}</h3><p className="muted">{subtitle}</p></div></div>}
function Empty({text}){return <div className="empty"><span>◌</span><p>{text}</p></div>}
function OrderTable({orders,customerName,detailed=false,productName=()=>''}){return <div className="table-wrap"><table><thead><tr><th>ORDER</th><th>CUSTOMER</th>{detailed&&<th>ITEMS</th>}<th>DATE</th><th>TOTAL</th><th>STATUS</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td><b>#{o.id}</b></td><td>{customerName(o.customer_id)}</td>{detailed&&<td>{o.items.map(i=><div key={i.id} className="cell-sub">{productName(i.product_id)} × {i.quantity}</div>)}</td>}<td>{new Date(o.created_at).toLocaleDateString()}</td><td><b>{money(o.total)}</b></td><td><span className={`pill ${o.status==='confirmed'?'pill-green':o.status==='rejected'?'pill-red':'pill-warn'}`}>{o.status.replaceAll('_',' ')}</span>{o.decision_note&&<small className="cell-sub">{o.decision_note}</small>}</td></tr>)}</tbody></table>{!orders.length&&<Empty text="No sales orders to display yet."/>}</div>}
