document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("materiales-form");
  const tablaMateriales = document.getElementById("tablaMateriales")?.querySelector("tbody");
  const btnAgregar = document.getElementById("agregarMaterial");

  if (btnAgregar) {
    btnAgregar.addEventListener("click", function () {
      agregarFila();
    });
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      guardarMaterial();
    });
  }

  function agregarFila() {
    const nombreMaterial = document.getElementById("nombreMaterial").value.trim();
    const cantidadMaterial = document.getElementById("cantidadMaterial").value.trim(); // TEXTO

    if (nombreMaterial === "" || cantidadMaterial === "") {
      alert("Por favor, completa todos los campos.");
      return;
    }

    if (!tablaMateriales) {
      // Si no hay tabla dinámica, solo guarda directo
      return guardarMaterial();
    }

    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${escapeHtml(nombreMaterial)}</td>
      <td>${escapeHtml(cantidadMaterial)}</td>
      <td><button type="button" class="btn btn-sm btn-danger eliminar">❌</button></td>
    `;

    tablaMateriales.appendChild(fila);

    // Limpiar
    document.getElementById("nombreMaterial").value = "";
    document.getElementById("cantidadMaterial").value = "";

    fila.querySelector(".eliminar").addEventListener("click", function () {
      fila.remove();
    });
  }

  function guardarMaterial() {
    const nombreMaterial = document.getElementById("nombreMaterial").value.trim();
    const cantidadMaterial = document.getElementById("cantidadMaterial").value.trim(); // TEXTO

    if (!nombreMaterial || !cantidadMaterial) {
      alert("Por favor, completa todos los campos.");
      return;
    }

    fetch('/guardar-material', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombreMaterial, cantidadMaterial }) // el server lo guarda como cantidad_texto
    }).then(response => {
      if (response.ok) {
        alert("Material guardado correctamente.");
        window.location.reload();
      } else {
        alert("Error al guardar el material.");
      }
    }).catch(error => {
      console.error('Error:', error);
      alert("Error al guardar el material.");
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"'`=\/]/g, s => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'
    }[s] || s));
  }
});
