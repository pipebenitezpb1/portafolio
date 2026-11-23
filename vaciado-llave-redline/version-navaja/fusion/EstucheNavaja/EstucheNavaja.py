# Script para Autodesk Fusion.  NO PROBADO en Fusion: se escribio sin poder ejecutarlo.
#
# Que hace, en un diseno abierto (puede ser uno nuevo y vacio):
#   1. importa todo_navaja.step y deja las piezas como cuerpos sueltos con nombre (sin componentes);
#   2. crea el boceto "Calcado de la llave" con el contorno trazado sobre la foto y el del vaciado,
#      mas dos puntos de referencia en (0,0) y (200,0) mm;
#   3. inserta foto_para_lienzo.png como lienzo en el plano XY.
# El lienzo queda con el tamano que Fusion le da por defecto.  Para dejarlo a escala:
#   clic derecho en el lienzo > Calibrar > clic en las dos cruces rojas > 200 mm,
#   y luego clic derecho > Editar lienzo para mover la cruz izquierda al origen.
#
# Como usarlo: Utilidades > Complementos > Scripts y complementos > "+" > elegir esta carpeta > Ejecutar.
import adsk.core, adsk.fusion, traceback, os, json


def run(context):
    app = adsk.core.Application.get()
    ui = app.userInterface
    avisos = []
    try:
        carpeta = os.path.dirname(os.path.realpath(__file__))
        datos = json.load(open(os.path.join(carpeta, 'datos.json')))
        design = adsk.fusion.Design.cast(app.activeProduct)
        if not design:
            ui.messageBox('Abre primero un diseno (espacio de trabajo Diseno).')
            return
        root = design.rootComponent

        # ---- 1. cuerpos ----
        antes = root.occurrences.count
        im = app.importManager
        im.importToTarget(im.createSTEPImportOptions(os.path.join(carpeta, 'todo_navaja.step')), root)
        try:
            nuevas = [root.occurrences.item(i) for i in range(antes, root.occurrences.count)]
            cuerpos = []
            for oc in nuevas:
                for comp_oc in [oc] + [oc.allChildOccurrences.item(i) for i in range(oc.allChildOccurrences.count)]:
                    for i in range(comp_oc.bRepBodies.count):
                        cuerpos.append(comp_oc.bRepBodies.item(i))
            movidos = [b.moveToComponent(root) for b in cuerpos]
            for oc in nuevas:
                oc.deleteMe()
            if len(movidos) == len(datos['nombres']):
                for b, n in zip(movidos, datos['nombres']):
                    b.name = n
            else:
                avisos.append('No se pudieron nombrar los cuerpos (se esperaban %d, llegaron %d).' % (len(datos['nombres']), len(movidos)))
        except:
            avisos.append('Los cuerpos quedaron dentro del componente importado; se pueden arrastrar a la raiz a mano.')

        # ---- 2. boceto con el calcado (Fusion trabaja en cm) ----
        sk = root.sketches.add(root.xYConstructionPlane)
        sk.name = 'Calcado de la llave'
        sk.isComputeDeferred = True
        P = lambda x, y: adsk.core.Point3D.create(x / 10.0, y / 10.0, 0)
        for clave in ('llave', 'vaciado'):
            for tramo in datos[clave]:
                if len(tramo) == 2:
                    sk.sketchCurves.sketchLines.addByTwoPoints(P(*tramo[0]), P(*tramo[1]))
                else:
                    col = adsk.core.ObjectCollection.create()
                    for x, y in tramo:
                        col.add(P(x, y))
                    sk.sketchCurves.sketchFittedSplines.add(col)
        sk.sketchPoints.add(P(0, 0))
        sk.sketchPoints.add(P(200, 0))
        sk.isComputeDeferred = False

        # ---- 3. lienzo ----
        try:
            entrada = root.canvases.createInput(os.path.join(carpeta, 'foto_para_lienzo.png'), root.xYConstructionPlane)
            lienzo = root.canvases.add(entrada)
            try:
                lienzo.name = 'Foto de la llave'
            except:
                pass
        except:
            avisos.append('No se pudo insertar el lienzo; insertalo a mano: Insertar > Lienzo > foto_para_lienzo.png.')

        app.activeViewport.fit()
        ui.messageBox('Listo.\n\nPara dejar la foto a escala: clic derecho en el lienzo > Calibrar, '
                      'clic en las dos cruces rojas y escribir 200 mm. Despues, Editar lienzo y mover '
                      'la cruz izquierda al origen.\n\n' + '\n'.join(avisos))
    except:
        if ui:
            ui.messageBox('Fallo:\n{}'.format(traceback.format_exc()))
