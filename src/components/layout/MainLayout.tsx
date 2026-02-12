import React, { useState, useEffect } from 'react';
import { Outlet, useParams, useOutletContext } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Project, ProjectStatus } from '../../types';
import { ProjectService } from '../../storage';
import { ProjectModal } from '../project/ProjectModal';
import { LoadingSpinner } from '../common/Loading';

// Context Type for Outlet
export type LayoutContextType = {
    activeProject: Project | null;
    projects: Project[];
    refreshProjects: () => void;
    setProjectModalOpen: (open: boolean) => void;
    setEditingProject: (p: Project | null) => void;
    isLoading: boolean;
};

export const MainLayout = () => {
    const { projectId } = useParams();
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeProject, setActiveProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [isProjectModalOpen, setProjectModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);

    const loadProjects = async () => {
        const list = await ProjectService.getAll();
        setProjects(list);
        return list;
    };

    useEffect(() => {
        setLoading(true);
        loadProjects().then((list) => {
            if (projectId) {
                const found = list.find(p => p.id === projectId);
                setActiveProject(found || null);
            } else {
                setActiveProject(null);
            }
            setLoading(false);
        });
    }, [projectId]);

    const handleCreateProject = async (title: string, desc: string, status: ProjectStatus) => {
        if (editingProject) {
            await ProjectService.update(editingProject.id, { title, description: desc, status });
        } else {
            await ProjectService.create(title, desc);
        }
        await loadProjects();
        setProjectModalOpen(false);
        setEditingProject(null);
    };

    const refreshProjects = async () => {
        await loadProjects();
    };

    // Allow rendering even if loading to show Sidebar skeleton or at least structure
    // But strictly blocking if critical data missing is also fine.
    // We exposed isLoading so children can decide.

    return (
        <div className="flex h-screen bg-gray-100 text-gray-900 font-sans overflow-hidden">
            <Sidebar
                activeProject={activeProject}
                projects={projects}
                setProjectModalOpen={(open) => { setEditingProject(null); setProjectModalOpen(open); }}
            />

            <div className="flex-1 overflow-hidden flex flex-col relative h-full">
                <Outlet context={{ activeProject, projects, refreshProjects, setProjectModalOpen, setEditingProject, isLoading: loading } satisfies LayoutContextType} />
            </div>

            <ProjectModal
                isOpen={isProjectModalOpen}
                onClose={() => setProjectModalOpen(false)}
                onSubmit={handleCreateProject}
                initialData={editingProject || undefined}
            />
        </div>
    );
};

export const useLayout = () => {
    return useOutletContext<LayoutContextType>();
}
